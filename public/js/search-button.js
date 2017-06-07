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

class SearchButton {
  constructor(router, options) {
    this._router = router;
    this._searchForm = document.querySelector('#search');
    this._searchInput = this._searchForm.querySelector('#search-input');
    this._searchButton = document.querySelector('#search-button');
    this._setupSearchButton();
    // this._setupSearchElements();
    this._options = options || {};
  }

  _setupSearchButton() {
    const searchButtonClick = event => {
      event.preventDefault();
      if (this._searchForm.classList.contains('hidden')) {
        this._searchForm.classList.remove('hidden');
        this._searchInput.focus();
        if (this._options.onShowForm) {
          this._options.onShowForm();
        }
        return;
      }
      this._searchForm.classList.add('hidden');
      if (this._options.onHideForm) {
        this._options.onHideForm();
      }
    };
    this._searchButton.addEventListener('click', searchButtonClick);
  }
 /**
  * Setup/configure search button
  */
  _setupSearchElements() {
    const eventHandler = event => {
      event.preventDefault();
        // const urlParams = new URLSearchParams(window.location.search);
        // // Only navigate if the search query changes
        // if (searchValue !== urlParams.get('query')) {
        //   this._router.navigate('/pwas/search?query=' + searchValue);
        // }
      document.querySelector('#search-input').focus();
    };
    document.querySelector('#search').addEventListener('submit', eventHandler);
  }
}

export default SearchButton;
