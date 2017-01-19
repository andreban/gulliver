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

/*
 * Generate gulliver.js from this file via `npm prestart`. (`npm start` will run
 * `prestart` automatically.)
 */

/* eslint-env browser */

// A Promise polyfill, as used by
// https://github.com/Financial-Times/polyfill-service/blob/master/polyfills/Promise/config.json
import 'yaku/dist/yaku.browser.global.min.js';
// A fetch polyfill, as used by
// https://github.com/Financial-Times/polyfill-service/blob/master/polyfills/fetch/config.json
import 'whatwg-fetch/fetch';

import {authInit} from './gapi.es6.js';
import './loader.js';
import Messaging from './messaging';
import NotificationCheckbox from './notification-checkbox';

/**
 * Translate generic "system" event like 'online', 'offline' and 'userchange'
 * into Gulliver-specific events. (e.g. as indicated by classes.)
 *
 * What this function does:
 *
 *   * all elements with class .gulliver-online-aware will:
 *     * have an 'online' dataset property that reflects the current online state.
 *     * receive a 'change' event whenever the state changes.
 *
 *   * all elements with class .gulliver-signedin-aware will:
 *     * have a 'signedin' dataset property that reflects the current signed in state.
 *     * receive a 'change' event whenever the state changes.
 *
 *   * the element #pwaForm also gets some special behaviour--see code. (This probably
 *     shouldn't happen here.)
 */
function setupEventHandlers() {
  window.addEventListener('online', () => {
    console.log('ONLINE');
    const onlineAware = document.querySelectorAll('.gulliver-online-aware');
    for (const e of onlineAware) {
      e.dataset.online = JSON.stringify(true);
      e.dispatchEvent(new CustomEvent('change'));
    }
  });

  window.addEventListener('offline', () => {
    console.log('OFFLINE');
    const onlineAware = document.querySelectorAll('.gulliver-online-aware');
    for (const e of onlineAware) {
      e.dataset.online = JSON.stringify(false);
      e.dispatchEvent(new CustomEvent('change'));
    }
  });

  window.addEventListener('userchange', e => {
    const user = e.detail;
    if (user.isSignedIn()) {
      console.log('id_token', user.getAuthResponse().id_token);
      const pwaForm = document.getElementById('pwaForm');
      if (pwaForm) {
        const idTokenInput = document.getElementById('idToken');
        idTokenInput.setAttribute('value', user.getAuthResponse().id_token);
      }
    } else {
      console.log('user signed out/never signed in');
      const pwaForm = document.getElementById('pwaForm');
      if (pwaForm) {
        const idTokenInput = document.getElementById('idToken');
        idTokenInput.setAttribute('value', '');
      }
    }
    const signedinAware = document.querySelectorAll('.gulliver-signedin-aware');
    for (const e of signedinAware) {
      e.dataset.signedin = JSON.stringify(user.isSignedIn());
      e.dispatchEvent(new CustomEvent('change'));
    }
  });
}

/**
 * Configures elements with class `gulliver-signed-aware` and
 * `gulliver-online-aware` to respond to 'change' events.
 */
function setupSignedinAware() {
  const list = document.querySelectorAll('.gulliver-signedin-aware.gulliver-online-aware');
  for (const e of list) {
    e.dataset.online = JSON.stringify(false);
    e.dataset.signedin = JSON.stringify(false);
    e.addEventListener('change', function() {
      const online = JSON.parse(this.dataset.online);
      const signedin = JSON.parse(this.dataset.signedin);
      switch (e.tagName.toLowerCase()) {
        case 'button':
          if (e.id === 'auth-button') {
            // auth-button state depends only on online state
            this.disabled = !online;
          } else {
            this.disabled = !online || !signedin;
          }
          break;
        case 'div':
          if (online && signedin) {
            this.style.opacity = 1;
            this.onclick = null;
          } else {
            this.style.opacity = 0.5;
            this.onclick = f => f.preventDefault();
          }
          break;
        default:
      }
    });
  }
}

/**
 * Configures elements with class `gulliver-online-aware` to respond to 'change'
 * events.
 */
function setupOnlineAware() {
  const l1 = document.querySelectorAll('div.button.gulliver-online-aware');
  for (const e of l1) {
    e.addEventListener('change', function() {
      if (JSON.parse(this.dataset.online)) {
        this.style.transition = 'opacity .5s ease-in-out';
        this.style.opacity = 1;
        this.onclick = null;
      } else {
        this.style.opacity = 0.5;
        this.onclick = f => f.preventDefault();
      }
    });
  }
  const l2 = document.querySelectorAll('a.card-pwa.gulliver-online-aware');
  for (const e of l2) {
    e.addEventListener('change', function() {
      if (JSON.parse(this.dataset.online)) {
        // Online, make element active
        this.style.transition = 'opacity .5s ease-in-out';
        this.style.opacity = 1;
        this.onclick = null;
        return;
      }
      const href = e.getAttribute('href');
      if (href) {
        fetch(href, {method: 'HEAD'}).then(r => {
          if (r.status === 200) {
            // Available in cache, allow click
            this.style.transition = 'opacity .5s ease-in-out';
            this.style.opacity = 1;
            this.onclick = null;
          } else {
            // Not cached, prevent click
            this.style.transition = 'opacity .5s ease-in-out';
            this.style.opacity = 0.5;
            this.onclick = f => f.preventDefault();
          }
        });
      }
    });
  }
  const l3 = document.querySelectorAll('div.offline-status.gulliver-online-aware');
  for (const e of l3) {
    e.innerHTML = 'Offline';
    e.addEventListener('change', function() {
      this.style.opacity = 1;
      this.style.display = 'block';
      if (JSON.parse(this.dataset.online)) {
        this.style.transition = 'opacity .5s ease-in-out';
        this.style.opacity = 0;
      } else {
        this.style.transition = 'opacity .5s ease-in-out';
        this.style.opacity = 1;
      }
    });
  }
}

/**
 * Setup/configure Google signin itself. This translates GSI events into 'userchange'
 * events on the window object.
 */
function setupSignin() {
  /* eslint-disable camelcase */
  const params = {
    scope: 'profile',
    client_id: window.__config.client_id,
    fetch_basic_profile: false
  };
  /* eslint-enable camelcase */

  return authInit(params).then(auth => {
    // Fire 'userchange' event on page load (not just when status changes)
    window.dispatchEvent(new CustomEvent('userchange', {
      detail: auth.currentUser.get()
    }));

    // Fire 'userchange' event when status changes
    auth.currentUser.listen(user => {
      window.dispatchEvent(new CustomEvent('userchange', {
        detail: user
      }));
    });

    const authButton = document.getElementById('auth-button');

    function updateAuthButtonLabel() {
      authButton.innerText = authButton.dataset.signedin === 'true' ?
        'Logout' :
        'Login';
    }

    authButton.addEventListener('change', updateAuthButtonLabel);
    updateAuthButtonLabel();

    authButton.addEventListener(
      'click',
      () => {
        if (authButton.dataset.signedin === 'true') {
          auth.signOut();
        } else {
          auth.signIn();
        }
      }
    );

    return auth;
  });
}

/**
 * Disable the save button after been clicked to avoid double submission.
 */
function setupSaveButton() {
  const submitButton = document.getElementById('pwaSubmit');
  if (submitButton) {
    submitButton.addEventListener('click', _ => {
      submitButton.disabled = true;
      document.getElementById('pwaForm').submit();
    });
  }
}

/**
 * Register service worker.
 */
function setupServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(r => {
      console.log('REGISTRATION', r);
    });
  } else {
    console.log('SW not registered; navigator.serviceWorker is not available');
  }
}

function setupConfig() {
  const config = document.getElementById('config');
  if (config) {
    window.__config = JSON.parse(config.innerHTML);
  } else {
    console.log('CONFIG NOT FOUND');
  }
}

function setupMessaging() {
  const NEW_APPS_TOPIC = 'new-apps';
  const firebaseMsgSenderId = window.__config.firebase_msg_sender_id;
  const checkbox = document.getElementById('notifications');
  console.log('Checkbox: ', checkbox);
  const messaging = new Messaging(firebaseMsgSenderId);
  // eslint-disable-next-line no-unused-vars
  const notificationCheckbox = new NotificationCheckbox(messaging, checkbox, NEW_APPS_TOPIC);
}

setupConfig();
setupOnlineAware();
setupSignedinAware();
setupSignin();
setupSaveButton();
setupEventHandlers();
setupServiceWorker();
setupMessaging();

// Fire 'online' or 'offline' event on page load. (Without this, would only
// fire on change.)
window.dispatchEvent(new CustomEvent(navigator.onLine ? 'online' : 'offline'));

// GA embed code
/* eslint-disable */
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
ga('create', window.__config.ga_id, 'auto');
ga('set', 'dimension1', navigator.onLine);
ga('send', 'pageview');

// Setup a listener to track Add to Homescreen events.
window.addEventListener('beforeinstallprompt', e => {
  e.userChoice.then(choiceResult => {
    ga('send', 'event', 'A2H', choiceResult.outcome);      
  });
});
/* eslint-enable */
