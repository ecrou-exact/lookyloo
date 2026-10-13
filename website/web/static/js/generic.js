"use strict";

function checkAllBoxes(name) {
  let checkboxs = document.getElementsByName(name);
  for(let i = 0; i < checkboxs.length ; i++) {
    checkboxs[i].checked = !checkboxs[i].checked;
  }
}

function openURLInNewTab(url) {
    let win = window.open(url, '_blank');
    if (win == null) {
        return false;
    }
    win.focus();
    return true;
}

function openTreeInNewTab(capture_uuid, hostnode_uuid=null) {
    let url = `/tree/${capture_uuid}`;
    if (hostnode_uuid != null) {
        url += `/${hostnode_uuid}`;
    }
    return openURLInNewTab(url);
}

// Parameters:
// contentType: The content type of your file.
//              its like application/pdf or application/msword or image/jpeg or
//              image/png and so on
// base64Data: Its your actual base64 data
// fileName: Its the file name of the file which will be downloaded.
// Source: https://stackoverflow.com/questions/14011021/how-to-download-a-base64-encoded-image
function downloadBase64File(contentType, base64Data, fileName) {
     const linkSource = `data:${contentType};base64,${base64Data}`;
     const downloadLink = document.createElement("a");
     downloadLink.href = linkSource;
     downloadLink.download = fileName;
     downloadLink.click();
}

function render_datetime_with_tz(data) {
    if(! isNaN(data)){
        data = parseInt(data);
    }
    const date = new Date(data);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.toTimeString()}`;
};

DataTable.render.datetime_with_tz = function () {
    return function ( data, type, row ) {
        if ( type === 'display' || type === 'filter') {
            return render_datetime_with_tz(data);
        }
        return data;
    };
}

// "3 days ago" with the exact date and time underneath and as a tooltip.
// Only builds markup from a parsed Date, never from the raw input.
function render_relative_time(data) {
    const date = new Date(isNaN(data) ? data : parseInt(data));
    if (isNaN(date.getTime())) {
        return '';
    }
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800],
                   ['day', 86400], ['hour', 3600], ['minute', 60]];
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    let relative = rtf.format(seconds, 'second');
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            relative = rtf.format(Math.round(seconds / size), unit);
            break;
        }
    }
    const absolute = render_datetime_with_tz(date.getTime());
    const short = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    const time = document.createElement('time');
    time.dateTime = date.toISOString();
    time.title = absolute;
    time.className = 'lk-relative-time';
    time.textContent = relative;
    const small = document.createElement('span');
    small.className = 'lk-absolute-time';
    small.textContent = short;
    time.appendChild(small);
    return time.outerHTML;
};

DataTable.render.relative_time = function () {
    return function ( data, type, row ) {
        if ( type === 'display' ) {
            return render_relative_time(data);
        }
        if ( type === 'filter' ) {
            return render_datetime_with_tz(data);
        }
        return data;
    };
}

function newTabClickListener() {
    document.querySelectorAll('.openNewTab').forEach(el => el.addEventListener('click', event => {
        if (window.opener === null) {
            return openTreeInNewTab(el.dataset.capture, el.dataset.hostnode)
        } else {
            let success = window.opener.openTreeInNewTab(el.dataset.capture, el.dataset.hostnode);
            if (! success) {
                alert("Your browser doesn't allow Lookyloo to open a new tab. There should be an icon on the right side of your URL bar *in the main window* to allow it.");
            }
        }
    }));
};

function downloadFaviconListener() {
  document.querySelectorAll(".downloadFaviconButton").forEach(el => el.addEventListener('click', event => {
    downloadBase64File(el.dataset.mimetype, el.dataset.b64favicon, el.dataset.filename);
  }))
};

function downloadOpfsFileListener() {
  document.querySelectorAll(".downloadOpfsFileButton").forEach(el => el.addEventListener('click', event => {
    downloadBase64File(el.dataset.mimetype, el.dataset.b64, el.dataset.filename);
  }))
};

function submitPandoraListener() {
  document.querySelectorAll('.submitPandoraButton').forEach(
      el => el.addEventListener('click', event => {
        submit_pandora(el.dataset.hostnode, el.dataset.hash, el.dataset.indexinzip, el.dataset.pandorasubmit);
  }));
};

function submit_pandora(node_uuid, ressource_hash, index_in_zip, pandora_submit_url){
  let data = {};
  if (node_uuid) {
      data.node_uuid = node_uuid;
  };
  if (ressource_hash) {
      data.ressource_hash = ressource_hash;
  };
  if (index_in_zip) {
      data.index_in_zip = index_in_zip;
  };
  fetch(pandora_submit_url, {
      method: "POST",
      body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(data => {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(data.link);
      }
      openURLInNewTab(data.link);
    })
    .catch((error) => {
        throw new Error(error);
    });
};

function add_event_js_copy() {
    // trigger all the BS tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    document.querySelectorAll('.js-copy').forEach(
        el => el.addEventListener('click', function(e) {
          e.stopImmediatePropagation();
          e.preventDefault();
          navigator.clipboard.writeText(el.dataset.copy).then(function() {
            el.setAttribute('data-bs-original-title', 'Copying to clipboard was successful!');
          }, function(err) {
            el.setAttribute('data-bs-original-title', 'Could not copy text: ' + err);
          }).then(function() {
            bootstrap.Tooltip.getInstance(el).show();
          });
        })
    );
};

if (document.getElementById('never_expire')) {
    document.getElementById('never_expire').addEventListener('change', function() {
        let disable_expire_at = document.getElementById('never_expire').checked;
        if (disable_expire_at) {
            document.getElementById("expire_at").disabled = true;
        } else {
            document.getElementById("expire_at").disabled = false;
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {

  // trigger all the BS tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

  document.querySelectorAll('.goBack').forEach(el => el.addEventListener('click', event => {
    window.history.back();
  }));

  document.querySelectorAll(".locateInTree").forEach(el => el.addEventListener('click', event => {
    window.opener.LocateNode(el.dataset.hostnode);
  }));

  // Make sure the never expire checkbox is never checked by default (macro monitoring_form)
  if (document.getElementById('never_expire')){
    document.getElementById("never_expire").checked = false;
  }

  add_event_js_copy();

  submitPandoraListener();
  newTabClickListener();
  renderTables();

});

// Blurred screenshot thumbnails (.lk-thumb, landing page): click to reveal / blur again.
// Delegated on document because the rows are (re)drawn by DataTables.
document.addEventListener('click', event => {
    const thumb = event.target.closest('.lk-thumb');
    if (!thumb) {
        return;
    }
    const blurred = thumb.classList.toggle('is-blurred');
    thumb.setAttribute('aria-pressed', blurred ? 'false' : 'true');
    const label = blurred ? 'Show the screenshot' : 'Blur the screenshot';
    thumb.setAttribute('aria-label', label);
    thumb.title = label;
});

// Server-rendered capture rows (home page): <span data-lk-time="ISO date"> becomes
// the same relative time as in the DataTables (render_relative_time).
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-lk-time]').forEach(el => {
        const rendered = render_relative_time(el.dataset.lkTime);
        if (rendered) {
            el.outerHTML = rendered;
        }
    });
});
