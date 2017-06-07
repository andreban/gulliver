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

/* eslint-env browser */

import SearchButton from './search-button';

export default class Shell {
  constructor(document, router) {
    this._currentState = {};
    this._router = router;
    this._document = document;
    this._backlink = document.querySelector('#backlink');
    this._tabs = document.querySelectorAll('#newest, #score');
    this._subtitle = document.querySelector('#subtitle');
    this._search = document.querySelector('#search');
    this._states = new Map();
    this._searchButton = new SearchButton(this._router, {
      onShowForm: () => {
        this._tabs.forEach(tab => this._showElement(tab, false));
      },
      onHideForm: () => {
        this._tabs.forEach(tab => this._showElement(tab, this._currentState.showTabs || false));
      }
    });
  }

  setStateForRoute(route, shellState) {
    this._states.set(route, shellState);
  }

  _showElement(element, visible) {
    if (visible) {
      element.classList.remove('hidden');
      return;
    }
    element.classList.add('hidden');
  }

  _updateTab(tab, options) {
    this._showElement(tab, options.showTabs);
    if (!options.currentTab) {
      return;
    }

    if (tab.id === options.currentTab) {
      tab.classList.add('activetab');
      return;
    }
    tab.classList.remove('activetab');
  }

  onRouteChange(route) {
    const options = this._states.get(route);
    this._currentState = options;
    this._showElement(this._backlink, options.backlink);
    this._showElement(this._subtitle, options.subtitle);
    this._showElement(this._search, options.search);
    this._tabs.forEach(tab => this._updateTab(tab, options));
  }
}
