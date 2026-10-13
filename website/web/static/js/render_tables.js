"use strict";

// Every DataTable shows the Lookyloo eyes instead of the default "Processing..." dots
// (lkLoader() from js/loader.js; the dots are hidden in css/components/loader.css).
DataTable.defaults.language.processing = lkLoader('Loading');

// Pagination in the URL: ?page=2 (and &length=25 when the page size was changed).
// Restored when the page is loaded, so a reload or a shared link opens the same page.
// Several tables on a page: the parameters are prefixed with the table id
// (?hostnameTable_page=2). Tables inside modals (capture tree) are left alone.
function lkPaginationKeys(table) {
    const several = [...document.querySelectorAll('table')].filter(t => !t.closest('.modal')).length > 1
                    && table.id;
    return several ? [`${table.id}_page`, `${table.id}_length`, `${table.id}_q`] : ['page', 'length', 'q'];
}

function lkPaginationEnabled(table) {
    return table && !table.closest('.modal');
}

// DataTables 3 triggers its events on the table only (no bubbling): bind them on
// each table now (this script runs after the tables are in the page, before any
// DataTable is created).
// DataTables 3 settings names (pageLength, displayStart, features, init), with the
// DataTables 1/2 names as a fallback.
function lkWantedPagination(table) {
    const [pageKey, lengthKey, searchKey] = lkPaginationKeys(table);
    const params = new URLSearchParams(window.location.search);
    return {page: parseInt(params.get(pageKey), 10), length: parseInt(params.get(lengthKey), 10),
            search: params.get(searchKey) || ''};
}

// Filters other than the DataTables search box, set in the URL (e.g. ?category= on
// the captures list): the reset button removes them too.
const LK_URL_FILTERS = ['category'];

function lkUrlFiltersActive() {
    const params = new URLSearchParams(window.location.search);
    return LK_URL_FILTERS.some(key => params.get(key));
}

// "Reset filters" button next to the search box, shown only when a filter is active
function lkResetButton(table, api) {
    const container = table.closest('.dt-container');
    if (!container) {
        return null;
    }
    let button = container.querySelector('.lk-dt-reset');
    if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm btn-outline-primary lk-dt-reset';
        button.innerHTML = '<span aria-hidden="true">&times;</span> ';
        button.appendChild(document.createTextNode('Reset filters'));
        button.hidden = true;
        button.addEventListener('click', () => {
            if (lkUrlFiltersActive()) {
                // URL filters are applied by the server: reload without them
                const url = new URL(window.location.href);
                [...LK_URL_FILTERS, ...lkPaginationKeys(table)].forEach(key => url.searchParams.delete(key));
                window.location.assign(url);
                return;
            }
            api.search('');
            api.columns().search('');
            api.page(0).draw();
        });
        const search = container.querySelector('.dt-search');
        (search || container).appendChild(button);
    }
    return button;
}

// Before the first load: jump to the page in the URL (saves a request for the
// server-side tables). Only when the page size is the default one.
function lkOnPreInit(e, settings) {
    // Read the URL once, before the first draw rewrites it
    const wanted = lkWantedPagination(e.currentTarget);
    e.currentTarget._lkWanted = wanted;
    const pageLength = settings.pageLength ?? settings._iDisplayLength;
    if (wanted.page > 1 && !wanted.length && pageLength > 0) {
        const start = (wanted.page - 1) * pageLength;
        if ('displayStart' in settings) {
            settings.displayStart = start;
            settings.displayStartInit = start;
        } else {
            settings._iDisplayStart = start;
        }
    }
}

// After the first load: apply what preInit could not (custom page size, tables
// loading their data afterwards).
function lkOnInit(e, settings) {
    const table = e.currentTarget;
    const wanted = table._lkWanted || lkWantedPagination(table);
    table._lkReady = true;
    const api = new DataTable.Api(settings);
    let changed = false;
    if (wanted.search && api.search() !== wanted.search) {
        api.search(wanted.search);
        changed = true;
    }
    if ((wanted.length > 0 || wanted.length === -1) && api.page.len() !== wanted.length) {
        api.page.len(wanted.length);
        changed = true;
    }
    if (wanted.page > 1 && api.page() !== wanted.page - 1 && wanted.page <= api.page.info().pages) {
        api.page(wanted.page - 1);
        changed = true;
    }
    if (changed) {
        api.draw(false);
    } else {
        lkOnDraw(e, settings);  // sync the URL and the reset button with the current state
    }
}

function lkOnDraw(e, settings) {
    const table = e.currentTarget;
    if (!table._lkReady) {
        return;  // first draw: the page asked by the URL is not applied yet (lkOnInit)
    }
    const api = new DataTable.Api(settings);
    const info = api.page.info();
    const [pageKey, lengthKey, searchKey] = lkPaginationKeys(table);
    const url = new URL(window.location.href);
    const search = api.search();
    if (search) {
        url.searchParams.set(searchKey, search);
    } else {
        url.searchParams.delete(searchKey);
    }
    // Array in DataTables 3, array-like API object before
    const columnsFiltered = Array.prototype.some.call(api.columns().search(), v => v);
    const reset = lkResetButton(table, api);
    if (reset) {
        reset.hidden = !(search || columnsFiltered || lkUrlFiltersActive());
    }
    if (info.page > 0) {
        url.searchParams.set(pageKey, info.page + 1);
    } else {
        url.searchParams.delete(pageKey);
    }
    const init = settings.init || settings.oInit || {};
    const defaultLength = init.pageLength || DataTable.defaults.pageLength;
    if (info.length !== defaultLength) {
        url.searchParams.set(lengthKey, info.length);
    } else {
        url.searchParams.delete(lengthKey);
    }
    if (url.href !== window.location.href) {
        history.replaceState(history.state, '', url);
    }
}

document.querySelectorAll('table').forEach(table => {
    if (lkPaginationEnabled(table)) {
        // DataTables triggers 'draw.dt': jQuery only calls handlers bound with that namespace
        $(table).on('preInit.dt', lkOnPreInit).on('init.dt', lkOnInit).on('draw.dt', lkOnDraw);
    }
});

function renderTables() {
  if (document.getElementById('IndexTable')) {
    let indexType = document.getElementById('IndexTable').dataset.indextype;
    new DataTable('#IndexTable', {
      processing: true,
      serverSide: true,
      retrieve: true,
      ordering: false,
      searching: true,
      drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
      order: [[ 1, "desc" ]],
      ajax: {
        url: `/tables/indexTable/${indexType}${window.location.search}`,
        type: 'POST',
      },
      language: {
        search: '',
        searchPlaceholder: 'Filter by title or URL',
        emptyTable: 'No capture to show yet.',
        zeroRecords: 'No capture matches this filter.',
      },
      columns : [
          { data: {_: 'page.display', filter: 'page.filter'}, width: '80%' },
          { data: 'capture_time', width: '20%', className: 'text-end', render: DataTable.render.relative_time() }
      ],
    })
  }
  if (document.getElementById('categoriesTable')) {
      new DataTable('#categoriesTable', {
        processing: true,
        retrieve: true,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        order: [[ 2, "desc" ]],
        pageLength: 10,
        ajax: {
            url: `/tables/categoriesTable/${window.location.search}`,
            type: 'POST',
            dataSrc:""
        },
        columns: [{ data: {_: 'category.display', filter: 'category.filter'}, width: '35%' },
                  { data: {_: 'machinetag.display', filter: 'machinetag.filter'}, width: '55%' },
                  { data: 'total_captures', width: '10%', orderable: true, className: 'text-end lk-categories-count' }]
      })
  }
  if (document.getElementById('HHHDetailsTable')) {
    let hhh = document.getElementById('HHHDetailsTable').dataset.hhh;
    new DataTable('#HHHDetailsTable', {
      processing: true,
      serverSide: true,
      retrieve: true,
      ordering: false,
      searching: true,
      drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
      ajax: {
          url: `/tables/HHHDetailsTable/${hhh}${window.location.search}`,
          type: 'POST'
      },
      columns : [
          { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
          { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
          { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
      ],
    })
  }
  if (document.getElementById('bodyHashDetailsTable')) {
    let bodyhash = document.getElementById('bodyHashDetailsTable').dataset.bodyhash;
    new DataTable('#bodyHashDetailsTable', {
      processing: true,
      serverSide: true,
      retrieve: true,
      ordering: false,
      searching: true,
      drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
      ajax: {
          url: `/tables/bodyHashDetailsTable/${bodyhash}${window.location.search}`,
          type: 'POST'
      },
      columns : [
          { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
          { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
          { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
      ],
    })
  }
  if (document.getElementById('hashTypeDetailsTable')) {
      let hash_value = document.getElementById('hashTypeDetailsTable').dataset.hashvalue;
      new DataTable('#hashTypeDetailsTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
            url: `/tables/hashTypeDetailsTable/${hash_value}${window.location.search}`,
            type: 'POST'
        },
        columns : [
            { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
            { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
            { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
      });
  }

  if (document.getElementById('identifierDetailsTable')) {
      let identifier_value = encodeURIComponent(document.getElementById('identifierDetailsTable').dataset.identifier);
      new DataTable('#identifierDetailsTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
            url: `/tables/identifierDetailsTable/${identifier_value}${window.location.search}`,
            type: 'POST'
        },
        columns : [
            { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
            { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
            { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
      });
  }
  if (document.getElementById('bodyHashesTable')) {
      let treeUUID = document.getElementById('bodyHashesTable').dataset.treeuuid;
      new DataTable('#bodyHashesTable', {
        processing: true,
        retrieve: true,
        searching: true,
        drawCallback: function (settings) {
            newTabClickListener(); add_event_js_copy();;
        },
        order: [[ 0, "desc" ]],
        ajax: {
            url: `/tables/bodyHashesTable/${treeUUID}${window.location.search}`,
            type: 'POST',
            dataSrc: ""
        },
        columns: [{ data: 'total_captures', width: '10%', orderable: false},
                  { data: {_: 'file_type.display', filter: 'file_type.filter'}, width: '10%' },
                  { data: {_: 'urls.display', filter: 'urls.filter'}, width: '60%', orderable: false },
                  { data: {_: 'sha512.display', filter: 'sha512.filter'}, width: '20%', orderable: false }],
      });
  }
  if (document.getElementById('faviconsTable')) {
      let treeUUID = document.getElementById('faviconsTable').dataset.treeuuid;
      new DataTable('#faviconsTable', {
        processing: true,
        retrieve: true,
        searching: true,
        drawCallback: function (settings) {
            newTabClickListener(); add_event_js_copy();;
            downloadFaviconListener();
        },
        order: [[ 0, "desc" ]],
        ajax: {
            url: `/tables/faviconsTable/${treeUUID}${window.location.search}`,
            type: 'POST',
            dataSrc: ""
        },
        columns: [{ data: 'total_captures', width: '10%' },
                  { data: {_: 'favicon.display', filter: 'favicon.filter'}, width: '40%', orderable: false },
                  { data: 'shodan_mmh3', width: '40%', orderable: false },
                  { data:  'download', width: '10%', orderable: false }],
      });
  }
  if (document.getElementById('treeHashesTable')) {
      let treeUUID = document.getElementById('treeHashesTable').dataset.treeuuid;
      new DataTable('#treeHashesTable', {
        processing: true,
        retrieve: true,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        order: [[ 0, "desc" ]],
        ajax: {
            url: `/tables/treeHashesTable/${treeUUID}${window.location.search}`,
            type: 'POST',
            dataSrc: ""
        },
        columns: [{ data: 'total_captures', width: '20%' },
                 { data: {_: 'capture_hash.display', 'filter': 'capture_hash.filter'}, width: '40%', orderable: false },
                 { data: 'hash_type', width: '40%', orderable: false }],
      });
  }
  if (document.getElementById('hostnamesTable')) {
      let treeUUID = document.getElementById('hostnamesTable').dataset.treeuuid;
      let hostname_table = new DataTable('#hostnamesTable', {
        processing: true,
        retrieve: true,
        searching: true,
        drawCallback: function (settings) {
            newTabClickListener(); add_event_js_copy();;
        },
        order: [[ 0, "desc" ]],
        ajax: {
            url: `/tables/hostnamesTable/${treeUUID}${window.location.search}`,
            type: 'POST',
            dataSrc: ""
        },
        columns: [{ data: 'total_captures', width: '10%' },
                  { data: {_: 'hostname.display', filter: 'hostname.filter'}, width: '30%', orderable: false },
                  { data: {_: 'ip.display', filter: 'ip.filter'}, width: '25%', orderable: false },
                  { data: {_: 'urls.display', filter: 'urls.filter'}, width: '35%', orderable: false }],
      });
  }
  if (document.getElementById('ipsTable')) {
      let treeUUID = document.getElementById('ipsTable').dataset.treeuuid;
      new DataTable('#ipsTable', {
        processing: true,
        retrieve: true,
        searching: true,
        drawCallback: function (settings) {
            newTabClickListener(); add_event_js_copy();;
        },
        order: [[ 0, "desc" ]],
        ajax: {
            url: `/tables/ipsTable/${treeUUID}${window.location.search}`,
            type: 'POST',
            dataSrc: ""
        },
        columns: [{ data: 'total_captures', width: '10%' },
                  { data: {_: 'ip.display', filter: 'ip.filter'}, width: '25%', orderable: false },
                  { data: {_: 'hostname.display', filter: 'hostname.filter'}, width: '30%', orderable: false },
                  { data: {_: 'urls.display', filter: 'urls.filter'}, width: '35%', orderable: false }],
      });
  }
  if (document.getElementById('identifiersTable')) {
      let treeUUID = document.getElementById('identifiersTable').dataset.treeuuid;
      new DataTable('#identifiersTable', {
        processing: true,
        retrieve: true,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        order: [[ 0, "desc" ]],
        ajax: {
            url: `/tables/identifiersTable/${treeUUID}${window.location.search}`,
            type: 'POST',
            dataSrc: ""
        },
        columns: [{ data: 'total_captures', width: '20%', orderable: false },
                  { data: {_: 'identifier.display', filter: 'identifier.filter'}, width: '40%', orderable: false },
                  { data: 'identifier_type', width: '40%', orderable: false }],
      });
  }
  if (document.getElementById('urlsTable')) {
      let treeUUID = document.getElementById('urlsTable').dataset.treeuuid;
      new DataTable('#urlsTable', {
        processing: true,
        retrieve: true,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        order: [[ 0, "desc" ]],
        ajax: {
            url: `/tables/urlsTable/${treeUUID}${window.location.search}`,
            type: 'POST',
            dataSrc:""
        },
        columns: [{ data: 'total_captures', width: '10%', orderable: false },
                  { data: {_: 'url.display', filter: 'url.filter'}, width: '90%', orderable: false }]
      })
  }
  if (document.getElementById('cookieNameTable')) {
      let cookieName = encodeURIComponent(document.getElementById('cookieNameTable').dataset.cookiename)
      new DataTable('#cookieNameTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
            url: `/tables/cookieNameTable/${cookieName}${window.location.search}`,
            type: 'POST'
        },
        columns : [
            { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
            { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
            { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
      });
  }

  if (document.getElementById('ipTable')) {
      let hostname = document.getElementById('ipTable').dataset.ip;
      new DataTable('#ipTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
           url: `/tables/ipTable/${hostname}${window.location.search}`,
           type: 'POST'
        },
        columns : [
           { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
           { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
           { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
    });
  }

  if (document.getElementById('hostnameTable')) {
      let hostname = document.getElementById('hostnameTable').dataset.hostname;
      new DataTable('#hostnameTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
           url: `/tables/hostnameTable/${hostname}${window.location.search}`,
           type: 'POST'
        },
        columns : [
           { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
           { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
           { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
    });
  }

  if (document.getElementById('domainTable')) {
      let domain = document.getElementById('domainTable').dataset.domain;
      new DataTable('#domainTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
           url: `/tables/domainTable/${domain}${window.location.search}`,
           type: 'POST'
        },
        columns : [
           { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
           { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
           { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
    });
  }


  if (document.getElementById('tldTable')) {
      let tld = document.getElementById('tldTable').dataset.tld;
      new DataTable('#tldTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
           url: `/tables/tldTable/${tld}${window.location.search}`,
           type: 'POST'
        },
        columns : [
           { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
           { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
           { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
    });
  }


  if (document.getElementById('urlTable')) {
      let url = document.getElementById('urlTable').dataset.url;
      new DataTable('#urlTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
            url: `/tables/urlTable/${url}${window.location.search}`,
            type: 'POST'
        },
        columns : [
            { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
            { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
            { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
      });
  }

  if (document.getElementById('faviconDetailsTable')) {
      let favicon = document.getElementById('faviconDetailsTable').dataset.favicon;
      new DataTable('#faviconDetailsTable', {
        processing: true,
        serverSide: true,
        retrieve: true,
        ordering: false,
        searching: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        ajax: {
           url: `/tables/faviconDetailsTable/${favicon}${window.location.search}`,
           type: 'POST'
        },
        columns : [
           { data: 'capture_time', width: '20%', render: DataTable.render.datetime_with_tz() },
           { data: {_: 'capture_title.display', filter: 'capture_title.filter'}, width: '40%' },
           { data: {_: 'landing_page.display', filter: 'landing_page.filter'}, width: '40%' }
        ],
      });
  }
 //It is allowed to have more than one table on the same page
  if (document.getElementsByName('CIRCL_pdns_table')) {
      document.getElementsByName('CIRCL_pdns_table').forEach(function(table) {
        let query = table.dataset.query;
        new DataTable(`#${table.id}`, {
          processing: true,
          retrieve: true,
          ordering: true,
          searching: true,
          drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
          order: [[ 1, "desc" ]],
          ajax: {
             url: `/tables/CIRCL_pdns_table/${query}${window.location.search}`,
             type: 'POST',
             dataSrc: "",
             data: {live: 'live' in table.dataset}
          },
          columns : [
             { data: 'time_first', width: '15%', render: DataTable.render.datetime_with_tz() },
             { data: 'time_last', width: '15%', render: DataTable.render.datetime_with_tz() },
             { data: 'rrtype', width: '10%' },
             { data: 'rdata', width: '20%' },
             { data: 'rrname', width: '40%' }
          ],
        });
      })
  }
  if (document.getElementById('storageStateCookiesTable')) {
      let cat_table = new DataTable('#storageStateCookiesTable', {
        retrieve: true,
        order: [[ 0, "desc" ]],
        pageLength: 25,
        columns: [
            {width: '7%'},
            {width: '15%'},
            {width: '20%'},
            {width: '12%'},
            {width: '13%'},
            {width: '10%', render: DataTable.render.datetime_with_tz()},
            {width: '5%'},
            {width: '5%'},
            {width: '6%'},
            {width: '5%'}
        ]
      });
  }
  if (document.getElementById('storageStateCookiesTable')) {
      let cat_table = new DataTable('#storageStateCookiesTable', {
        retrieve: true,
        order: [[ 0, "desc" ]],
        pageLength: 25,
        columns: [
            {width: '15%'},
            {width: '20%'},
            {width: '15%'},
            {width: '25%'},
            {width: '25%'}
        ]
      });
  }
  if (document.getElementById('consoleMessagesTable')) {
      let cm_table = new DataTable('#consoleMessagesTable', {
        retrieve: true,
        order: [[ 0, "desc" ]],
        pageLength: 25,
        columns: [
            {width: '20%', render: DataTable.render.datetime_with_tz()},
            {width: '10%'},
            {width: '30%'},
            {width: '25%'},
            {width: '5%'},
            {width: '10%'}
        ]
      });
  }
  if (document.getElementsByName('opfsTable').length > 0) {
    let opfsTables = document.getElementsByName("opfsTable");
    Array.from(opfsTables).forEach(function (opfsTable) {
      let cat_table = new DataTable(`#${opfsTable.id}`, {
        retrieve: true,
        order: [[ 0, "desc" ]],
        pageLength: 25,
        drawCallback: function (settings) { downloadOpfsFileListener(); },
        columns: [
            {width: '50%'},
            {width: '20%'},
            {width: '20%'},
            {width: '10%'}
        ]
      });
    });
  }
  if (document.getElementsByName('localStorageTable').length > 0) {
    let localStorageTables = document.getElementsByName("localStorageTable");
    Array.from(localStorageTables).forEach(function (localStorageTable) {
      let cat_table = new DataTable(`#${localStorageTable.id}`, {
        retrieve: true,
        order: [[ 0, "desc" ]],
        pageLength: 25,
        columns: [
            {width: '20%'},
            {width: '80%'}
        ]
      });
    });
  }
  if (document.getElementById('category_table')) {
      let cat_table = new DataTable('#category_table', {
        retrieve: true,
        drawCallback: function (settings) { newTabClickListener(); add_event_js_copy(); },
        order: [[ 0, "desc" ]],
        pageLength: 25,
        lengthMenu: [25, 50, {label: 'All', value:-1} ],

        rowGroup: {
            dataSrc: [0],
        },
        columns: [{visible: false },
                  { width: '60%', orderable: false },
                  { width: '35%', orderable: false },
                  { width: '5%', orderable: false, render: DataTable.render.select()}],
        select: {
          style: 'multi',
          headerCheckbox: false,
        },
        layout: {
            topStart: {
                buttons: [
                  {
                    extend: 'selected',
                    text: 'Review categories',
                    action: function (e, dt, button, config) {
                        let counter = dt.rows( { selected: true } ).count()
                        let tags = dt.cells( dt.rows( { selected: true } ).nodes(), 2).data().toArray();
                        document.getElementById('categories_counter').innerText = counter;
                        let list = document.getElementById("categories_selected");
                        list.innerHTML = '';
                        tags.forEach((item) => {
                            let elt = document.createElement("div");
                            elt.className = "form-check";
                            elt.innerHTML = `<input class="form-check-input" type="checkbox" name="categories" value='${item}' checked hidden> <label class="form-check-label">${item}</label>`;
                            list.appendChild(elt);
                        });
                        document.getElementById('new_categories').style.display = 'block';
                    }
                  }
                ],
            }
        }
      });

      cat_table.rows('.selected').select();
      cat_table.on('user-select', function (e, dt, type, cell, originalEvent) {
          if (originalEvent.target.parentNode.classList.contains("unselectable") ||
              originalEvent.target.parentNode.parentNode.classList.contains("unselectable")) {
              e.preventDefault();
          }
      });
  }
};
