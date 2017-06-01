/**
 * Copyright 2015-2016, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const express = require('express');
const pwaLib = require('../lib/pwa');
const libPwaIndex = require('../lib/pwa-index');
const verifyIdToken = require('../lib/verify-id-token');
const lighthouseLib = require('../lib/lighthouse');
const Pwa = require('../models/pwa');
const router = express.Router(); // eslint-disable-line new-cap
const libMetadata = require('../lib/metadata');

const LIST_PAGE_SIZE = 32;
const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_SORT_ORDER = 'newest';

/**
 * Setup the list template view state
 */
function setupListViewState(req) {
  const viewState = {};
  if (typeof req.query.query === 'undefined') {
    viewState.mainPage = true;
    viewState.backlink = false;
    viewState.search = false;
  } else {
    viewState.mainPage = false;
    viewState.backlink = true;
    viewState.search = true;
    viewState.searchQuery = req.query.query;
  }
  viewState.contentOnly = false || req.query.contentOnly;
  viewState.pageNumber = parseInt(req.query.page, 10) || DEFAULT_PAGE_NUMBER;
  viewState.sortOrder = req.query.sort || DEFAULT_SORT_ORDER;
  viewState.start = parseInt(req.query.start, 10) || (viewState.pageNumber - 1) * LIST_PAGE_SIZE;
  viewState.limit = parseInt(req.query.limit, 10) || LIST_PAGE_SIZE;
  viewState.end = viewState.pageNumber * LIST_PAGE_SIZE;
  return viewState;
}

/**
 * Setup the list template view arguments
 */
function setupListViewArguments(req, viewState, result) {
  return Object.assign(libMetadata.fromRequest(req), {
    title: 'PWA Directory',
    description: 'PWA Directory: A Directory of Progressive Web Apps',
    pwas: result.pwas,
    hasNextPage: result.hasMore,
    hasPreviousPage: viewState.pageNumber > 1,
    nextPageNumber: viewState.pageNumber + 1,
    previousPageNumber: (viewState.pageNumber === 2) ? false : viewState.pageNumber - 1,
    currentPageNumber: viewState.pageNumber,
    sortOrder: (viewState.sortOrder === DEFAULT_SORT_ORDER) ? false : viewState.sortOrder,
    showNewest: viewState.sortOrder === 'newest',
    showScore: viewState.sortOrder === 'score',
    startPwa: viewState.start + 1,
    mainPage: viewState.mainPage,
    search: viewState.search,
    backlink: viewState.backlink,
    searchQuery: viewState.searchQuery,
    contentOnly: viewState.contentOnly
  });
}

/**
 * GET /
 *
 * Display a page of PWAs (up to LIST_PAGE_SIZE at a time)
 */
router.get('/', (req, res, next) => {
  const viewState = setupListViewState(req);
  pwaLib.list(viewState.start, viewState.limit, viewState.sortOrder).then(result =>
    render(res, 'pwas/list.hbs', setupListViewArguments(req, viewState, result)))
  .then(html => res.send(html))
  .catch(err => {
    err.status = 500;
    next(err);
  });
});

/**
 * GET /pwas/search
 *
 * Display a search result page of PWAs
 */
router.get('/search', (req, res, next) => {
  const viewState = setupListViewState(req);
  libPwaIndex.searchPwas(viewState.searchQuery).then(result =>
    render(res, 'pwas/list.hbs', setupListViewArguments(req, viewState, result)))
  .then(html => res.send(html))
  .catch(err => {
    err.status = 500;
    next(err);
  });
});

/**
 * GET /pwas/add
 *
 * Display a form for creating a PWA.
 */
router.get('/add', (req, res) => {
  const contentOnly = false || req.query.contentOnly;
  let arg = Object.assign(libMetadata.fromRequest(req), {
    title: 'PWA Directory - Submit a PWA',
    description: 'PWA Directory: Submit a Progressive Web Apps',
    pwa: {},
    action: 'Add',
    backlink: true,
    submit: true,
    contentOnly: contentOnly
  });
  res.render('pwas/form.hbs', arg);
});

/**
 * POST /pwas/add
 *
 * Create a PWA.
 */
router.post('/add', (req, res, next) => {
  let manifestUrl = req.body.manifestUrl.trim();
  if (manifestUrl.startsWith('http://')) {
    manifestUrl = manifestUrl.replace('http://', 'https://');
  }
  const idToken = req.body.idToken;
  let pwa = new Pwa(manifestUrl);

  if (!manifestUrl || !idToken) {
    let arg = Object.assign(libMetadata.fromRequest(req), {
      pwa,
      backlink: true,
      error: (manifestUrl) ? 'user not logged in' : 'no manifest provided'
    });
    res.render('pwas/form.hbs', arg);
    return;
  }

  verifyIdToken.verifyIdToken(idToken)
    .then(user => {
      pwa.setUser(user);
      return pwaLib.createOrUpdatePwa(pwa);
    })
    .then(savedData => {
      res.redirect(req.baseUrl + '/' + savedData.id);
      return;
    })
    .catch(err => {
      if (typeof err === 'number') {
        switch (err) {
          case pwaLib.E_MANIFEST_INVALID_URL:
            err = `pwa.manifestUrl [${pwa.manifestUrl}] is not a valid URL`;
            break;
          case pwaLib.E_MISING_USER_INFORMATION:
            err = 'Missing user information';
            break;
          case pwaLib.E_MANIFEST_URL_MISSING:
            err = 'Missing manifestUrl';
            break;
          case pwaLib.E_NOT_A_PWA:
            err = 'pwa is not an instance of Pwa';
            break;
          default:
            return next(err);
        }
      }
      // Transform err from an array of strings (in a particular format) to a
      // comma-separated string.
      if (Array.isArray(err)) {
        const s = err.map(e => {
          const m = e.match(/^ERROR:\s+(.*)\.$/);
          return m ? m[1] : e; // if no match (format changed?), just return the string
        }).join(', ');
        err = s;
      }
      let arg = Object.assign(libMetadata.fromRequest(req), {
        pwa,
        backlink: true,
        error: err
      });
      res.render('pwas/form.hbs', arg);
      return;
    });
});

/**
 * GET /pwas/:id
 *
 * Display a PWA.
 */
router.get('/:pwa', (req, res, next) => {
  renderOnePwa(req, res)
    .then(html => res.send(html))
    .catch(err => {
      err.status = 404;
      return next(err);
    });
});

/**
 * Generate the HTML with 'pwas/view.hbs' for one PWA
 */
function renderOnePwa(req, res) {
  const url = req.originalUrl;
  const pwaId = req.params.pwa;
  const contentOnly = false || req.query.contentOnly;
  return pwaLib.find(pwaId)
    .then(pwa => {
      return lighthouseLib.findByPwaId(pwaId)
        .then(lighthouse => {
          if (lighthouse && lighthouse.lighthouseInfo &&
              Object.prototype.toString.call(lighthouse.lighthouseInfo) === '[object String]') {
            lighthouse.lighthouseInfo = JSON.parse(lighthouse.lighthouseInfo);
          }
          let arg = Object.assign(libMetadata.fromRequest(req, url), {
            pwa: pwa,
            lighthouse: lighthouse,
            rawManifestJson: JSON.parse(pwa.manifest.raw),
            title: 'PWA Directory: ' + pwa.name,
            description: 'PWA Directory: ' + pwa.name + ' - ' + pwa.description,
            backlink: true,
            contentOnly: contentOnly
          });
          return render(res, 'pwas/view.hbs', arg);
        });
    });
}

/**
 * res.render as a Promise
 */
function render(res, view, options) {
  return new Promise((resolve, reject) => {
    res.render(view, options, (err, html) => {
      if (err) {
        console.log(err);
        reject(err);
      }
      resolve(html);
    });
  });
}

/**
 * Errors on "/pwas/*" routes.
 */
router.use((err, req, res, next) => {
  // Format error and forward to generic error handler for logging and
  // responding to the request
  err.response = err.message;
  console.error(err);
  next(err);
});

module.exports = router;
