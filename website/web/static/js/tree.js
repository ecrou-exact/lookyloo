"use strict";
// From : https://bl.ocks.org/d3noob/43a860bc0024792f8803bba8ca0d5ecd

// Set the dimensions and margins of the diagram.
// The tree is drawn in a scrolling viewport under the capture bar (tree/tree.html),
// so it only needs room for the parent-capture box above the root.
// top: room for the parent-capture box above the root, and for the controls
// floating over the top of the tree (layout buttons, "Neighbours of" pill), so
// the nodes of the first rows are never hidden under them.
let margin = {
    top: 80,
    right: 200,
    bottom: 40,
    left: 90
};

// The SVG covers at least the visible part of the viewport
const tree_viewport = document.getElementById('tree_viewport');
let min_height = Math.max(tree_viewport.clientHeight - margin.top - margin.bottom, 300);
let min_width = Math.max(tree_viewport.clientWidth - margin.left - margin.right, 600);

let node_width = 10;
let node_height = 55;
let center_node = null;

// Keys selected in the legend filter (tree/legend.html): the nodes having at
// least one of them are highlighted, the others dimmed. Before the first await.
const active_filters = new Set();
// Text of the search field over the tree (lower case, '' = no text filter)
let search_text = '';
let search_index = -1;   // match centred by the previous / next buttons
// Node focused by a click on its card: it and its neighbours (parent, children) stay lit
let focus_uuid = null;

// Orientation of the tree: 'horizontal' (root on the left) or 'vertical' (root at
// the top), switched with the tree controls and remembered (localStorage).
let orientation = 'horizontal';
try {
    if (localStorage.getItem('lk-tree-orientation') === 'vertical') orientation = 'vertical';
} catch (e) { /* storage unavailable */ }
// Vertical: height of a depth row (card + thumbnail of the rendered node + gap)
const VERTICAL_ROW = 190;
let tree_root = null;

// ---- Analysis state (declared before the first await: used while the tree loads)

// Comparison with another capture: hostnames of the other capture (null = off),
// and "only the new hosts" filter
let compare_hosts = null;
let compare_only_new = false;

// Notes of the analyst: {hostnode uuid: {host, text, updated}}, in this browser
const NOTES_KEY = `lk-notes:${treeUUID}`;
let notes = {};
try { notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}') || {}; } catch (e) { notes = {}; }
const TWO_LEVEL_SUFFIXES = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'ltd.uk', 'plc.uk',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'co.nz', 'org.nz', 'govt.nz',
    'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp', 'co.kr', 'or.kr', 'co.in', 'net.in', 'org.in', 'gov.in',
    'com.br', 'net.br', 'org.br', 'gov.br', 'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'com.tw', 'com.hk',
    'com.mx', 'com.ar', 'com.tr', 'com.sg', 'com.my', 'co.za', 'co.il', 'co.id', 'co.th', 'com.ua',
    'com.pl', 'com.ru', 'com.es', 'com.pt', 'gouv.fr', 'asso.fr', 'co.at', 'or.at', 'gv.at']);

// Path from the root to the node of the rendered page (the "main path")
let main_path = new Set();

// Points of attention: kinds of nodes an analyst checks first. Each one is a key
// of the legend filter (tree/legend.html), so a chip toggles the same filter.
const ATTENTION = [
    {key: 'malicious', label: 'malicious', level: 'danger', title: 'Nodes with known malicious content'},
    {key: 'posted_data', label: 'sending data (POST)', level: 'warning', title: 'Nodes that POST content: forms, tracking, exfiltration'},
    {key: 'downloaded_filename', label: 'download', level: 'warning', title: 'Nodes containing a downloaded file'},
    {key: 'http_content', label: 'unencrypted', level: 'warning', title: 'Nodes with plain HTTP requests'},
    {key: 'mixed_content', label: 'mixed content', level: 'warning', title: 'HTTPS nodes loading plain HTTP content'},
    {key: 'redirect_to_nothing', label: 'redirect to nowhere', level: 'info', title: 'Redirects to URLs missing in the capture'},
    {key: 'third_party_cookies_received', label: 'third-party cookies', level: 'info', title: 'Nodes receiving cookies from a third party'},
    {key: 'third_party', label: 'third-party hosts', level: 'neutral', title: 'Hosts outside the domain of the rendered page'},
];

// Centre an element of the tree in #tree_viewport, scrolling only the viewport
// (scrollIntoView would also scroll the page).
function centerInViewport(element, smooth=true) {
    const viewport = tree_viewport.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    tree_viewport.scrollTo({
        left: tree_viewport.scrollLeft + box.left - viewport.left - (viewport.width - box.width) / 2,
        top: tree_viewport.scrollTop + box.top - viewport.top - (viewport.height - box.height) / 2,
        behavior: smooth && !reduce_motion ? 'smooth' : 'auto',
    });
}
window.centerInViewport = centerInViewport;   // also used by js/tree_modals.js (LocateNode)

// Position of a node on screen (d3.tree gives x = breadth, y = depth)
function nodePos(d, previous=false) {
    const x = previous ? d.x0 : d.x;
    const y = previous ? d.y0 : d.y;
    return orientation === 'horizontal' ? [y, x] : [x, y];
}
// Parts of a node that move with the orientation: the expand / collapse circle
// (right side of the card, or middle of its bottom edge where the links to the
// children start) and the favicon / thumbnail of the rendered node (kept clear
// of the circle).
function placeNodeParts(selection) {
    const vertical = orientation === 'vertical';
    selection.each(function(d) {
        const node = d3.select(this);
        const width = d.node_width || 0;
        node.select('circle.node')
            .attr('cx', vertical ? width / 2 : width)
            .attr('cy', vertical ? node_height + 5 : node_height / 2);
        const thumb_x = vertical ? width / 2 + 16 : width / 2;
        node.select('#screenshot_thumbnail').attr('x', thumb_x);
        node.select('.node-thumb-frame').attr('x', thumb_x);
        const favicon_x = vertical ? width / 2 - 16 - 35 : width / 6;
        node.select('#favicon').attr('x', favicon_x);
        node.select('.node-favicon-chip').attr('x', favicon_x - 3);
    });
}

function nodeTransform(d, previous=false) {
    const [px, py] = nodePos(d, previous);
    return `translate(${px}, ${py})`;
}

// First display: the tree grows from the root, one depth column after the other
// (animateTreeEntry). Off with prefers-reduced-motion.
const reduce_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let tree_entry_done = false;
const ENTRY_STEP_MS = 160;   // delay between two depth columns
const ENTRY_MOVE_MS = 420;   // duration of the move of a node

document.getElementById('tree_svg').style.width = min_width;
document.getElementById('tree_svg').style.height = min_height;

let main_svg = d3.select("#tree_svg").append("svg")
            .attr("width", min_width + margin.right + margin.left)
            .attr("height", min_height + margin.top + margin.bottom)

// dummy container for tooltip
d3.select('body')
    .append('div')
    .attr('id', 'tooltip')
    .attr('class', 'tooltip')
    .attr('style', 'position: absolute; opacity: 0;');

// Define SVGs
let defs = main_svg.append("defs");

// Add background pattern
let pattern = defs.append('pattern')
    .attr('id', 'backstripes')
    .attr('x', margin.left)
    .attr("width", node_width * 2)
    .attr("height", min_height)
    .attr('patternUnits', "userSpaceOnUse" )

// Colours of the tree come from css/tree.css (--lk-color-tree-* tokens), not from attributes
pattern.append('rect')
    .attr('class', 'tree-stripe')
    .attr('width', node_width)
    .attr('height', min_height);

// append the svg object to the body of the page
// appends a 'group' element to 'svg'
// moves the 'group' element to the top left margin
let node_container = main_svg.append("g")
                             .attr("transform", `translate(${margin.left}, ${margin.top})`);

// declares a tree layout
let tree = d3.tree();

try {
  const treeDumpURL = document.getElementById('tree_js').dataset.remote;
  const response = await fetch(treeDumpURL);
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  const treeData = await response.json();

  // Assigns parent, children, height, depth
  let root = d3.hierarchy(treeData);
  root.x0 = min_height / 2;
  root.y0 = 0;

  document.getElementById("tree-loading").style.display = "none";
  tree_root = root;
  prepareAnalysis(root);
  update(root);
  setupLegendFilter(root);
  setupAttention(root);
  setupTreeSearch();
  setupTreeControls();
  setupNotes();
  setupCompare();
  setupFullscreen();
  setupBackground();
  node_container.selectAll('g.node').classed('has-note', d => Boolean(notes[d.data.uuid]));
  // Scroll once the nodes are in place
  await animateTreeEntry(root);

  if (document.getElementById('tree_js').dataset.urlnode != null){
    history.scrollRestoration = "manual";
    LocateNode(document.getElementById('tree_js').dataset.urlnode);
  }
  else {
    let rendered_node = document.getElementById('screenshot_thumbnail');
    centerInViewport(rendered_node);
  }

  if (parent_uuid != null) {

      let parent_box_y = root.y - 70;
      let parent_box_x = root.x - 150;

      let parent_rect = node_container.append('rect')
        .attr('class', 'tree-parent-box')
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("transform", `translate(${parent_box_y}, ${parent_box_x})`)

      let text = node_container
          .data([
              {
                  "line1": 'This capture was triggered',
                  "line2": 'from a previous capture.',
                  "line3": 'See the parent',
                  "parent_uuid": parent_uuid
              }
          ])
          .append('text')
          .attr('class', 'tree-parent-text')
          .attr("dy", 0)
          .style('text-align', 'center')
          .attr("transform", `translate(${parent_box_y + 3}, ${parent_box_x + 15})`);

      text
          .append('tspan')
          .text(d => d.line1);

      text
          .append('tspan')
          .attr("x", 8)
          .attr("dy", 18)
          .text(d => d.line2);

      text
          .append('tspan')
          .attr("x", 30)
          .attr("dy", 20)
          .text(d => d.line3)
          .attr('class', 'tree-parent-link')
          .attr('cursor', 'pointer')
          .on('click', (event, d) => { openTreeInNewTab(d.parent_uuid) } );

      parent_rect
          .attr('width', text.node().getBBox().width + 6)
          .attr('height', text.node().getBBox().height + 10)

      let line_arrow = node_container
                         .append('g');
                         //.attr("transform", `translate(${root.y}, ${root.x})`);

      let line = d3.line()
                      // Other options: http://bl.ocks.org/d3indepth/raw/b6d4845973089bc1012dec1674d3aff8/
                      //.curve(d3.curveCardinal)
                      .curve(d3.curveBundle)
                      .x(point => point.lx)
                      .y(point => point.ly);

      let line_tip = d3.symbol()
                      .type(d3.symbolTriangle)
                      .size(200);

      line_arrow
          .append("path")
          .attr('class', 'tree-parent-arrow')
          .data([{
              source: {x: 0, y: parent_box_x + parent_rect.node().getBBox().height},
              target: {x: 50, y: parent_box_x + parent_rect.node().getBBox().height + 42}
          }])
          .attr("d", d => line(
              [{lx: d.source.x, ly: d.source.y},
               {lx: d.target.x, ly: d.source.y},
               {lx: d.target.x, ly: d.target.y}
              ])
          );

      line_arrow
          .append("path")
          .attr('class', 'tree-parent-arrow tree-parent-arrow-tip')
          .attr("d", line_tip)
          .attr("transform", `translate(50, ${parent_box_x + parent_rect.node().getBBox().height + 48}) rotate(60)`);
  };
} catch (error) {
  console.error(error.message);
}


// ****************** Analysis helpers: main path, third parties, points of attention ******************

// Registrable domain of a hostname, without the Public Suffix List: the last
// two labels, three when the last two are a known two-level suffix (co.uk…).
function registrableDomain(hostname) {
    const host = (hostname || '').toLowerCase().replace(/\.$/, '');
    if (/^[\d.]+$/.test(host) || host.includes(':')) return host;   // IP address
    const labels = host.split('.');
    if (labels.length <= 2) return host;
    const last_two = labels.slice(-2).join('.');
    return TWO_LEVEL_SUFFIXES.has(last_two) ? labels.slice(-3).join('.') : last_two;
}


// Marks computed once on the data: third_party (host outside the domain of the
// rendered page) and the main path.
function prepareAnalysis(root) {
    const all = allNodes(root);
    const rendered = all.find(d => d.data.contains_rendered_urlnode) || root;
    const page_domain = registrableDomain(rendered.data.name);
    all.forEach(d => {
        d.data.third_party = registrableDomain(d.data.name) !== page_domain;
    });
    main_path = new Set(rendered.ancestors().map(d => d.data.uuid));
}

// ****************** Network info of a node (panel on hover) ******************

// [label, value] lines from the DNS data of a node (tree dump: resolved_ips
// {v4, v6}, ns / mx [zone, records], soa [zone, "mname rname serial …"])
function networkLines(d) {
    const lines = [];
    const list = value => (value instanceof Array ? value : value ? [value] : []).filter(Boolean).map(String);
    const ips = d.data.resolved_ips || {};
    const v4 = list(ips.v4 instanceof Array ? ips.v4 : ips.v4 && typeof ips.v4 === 'object' ? Object.keys(ips.v4) : ips.v4);
    const v6 = list(ips.v6 instanceof Array ? ips.v6 : ips.v6 && typeof ips.v6 === 'object' ? Object.keys(ips.v6) : ips.v6);
    if (v4.length) lines.push(['IPv4', v4.join(', ')]);
    if (v6.length) lines.push(['IPv6', v6.join(', ')]);
    const [ns_zone, ns_records] = d.data.ns || [];
    const [, mx_records] = d.data.mx || [];
    const [soa_zone, soa_record] = d.data.soa || [];
    if (ns_zone) lines.push(['DNS zone', ns_zone]);
    if (soa_zone || soa_record) {
        const primary = soa_record ? String(soa_record).split(' ')[0].replace(/\.$/, '') : '';
        lines.push(['SOA', [soa_zone, primary && primary !== soa_zone ? `primary ${primary}` : ''].filter(Boolean).join(' · ')]);
    }
    if (list(ns_records).length) lines.push(['NS', list(ns_records).join(', ')]);
    if (list(mx_records).length) lines.push(['MX', list(mx_records).join(', ')]);
    return lines;
}

// ****************** Notes of the analyst ******************

function saveNotes() {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch (e) { /* not kept */ }
    renderNotes();
    node_container.selectAll('g.node').classed('has-note', d => Boolean(notes[d.data.uuid]));
}

// The note being edited in #noteModal: {uuid, host}, and its current text
let note_target = null;
let note_text = '';

function editNote(uuid, host) {
    // The editor is a modal of the page: leave the full screen tree first
    if (document.fullscreenElement) document.exitFullscreen();
    note_target = {uuid, host};
    note_text = notes[uuid]?.text || '';
    hideNodeInfo();
    document.getElementById('note-modal-host').textContent = host;
    document.getElementById('note-modal-delete').hidden = !notes[uuid];
    const editor = document.getElementById('note-markdown');
    customElements.whenDefined('vt-markdown').then(() => { editor.content = note_text; });
    bootstrap.Modal.getOrCreateInstance('#noteModal').show();
}

function saveNote() {
    if (!note_target) return;
    const text = note_text.trim();
    if (text) {
        notes[note_target.uuid] = {host: note_target.host, text, updated: new Date().toISOString()};
    } else {
        delete notes[note_target.uuid];
    }
    saveNotes();
    bootstrap.Modal.getOrCreateInstance('#noteModal').hide();
}

function deleteNote(uuid) {
    delete notes[uuid];
    saveNotes();
}

// Markdown export: the capture, then one section per noted node
function notesMarkdown() {
    const lines = [`# Notes on the capture of ${capture_info.url}`, ''];
    if (capture_info.title) lines.push(`- Page title: ${capture_info.title}`);
    lines.push(`- Capture: ${document.location.origin}/tree/${treeUUID}`);
    if (capture_info.time) lines.push(`- Captured: ${capture_info.time}`);
    lines.push('');
    Object.entries(notes).forEach(([uuid, note]) => {
        lines.push(`## ${note.host}`, '', note.text, '', `<${document.location.origin}/tree/${treeUUID}/${uuid}>`, '');
    });
    return lines.join('\n');
}

function renderNotes() {
    const list = document.getElementById('tree-notes-list');
    if (!list) return;
    list.textContent = '';
    const entries = Object.entries(notes);
    entries.forEach(([uuid, note]) => {
        const item = document.createElement('li');
        const host = document.createElement('button');
        host.type = 'button';
        host.className = 'lk-notes-host';
        host.textContent = note.host;
        host.title = 'Show this node';
        host.addEventListener('click', () => {
            const node = document.getElementById(`node_${uuid}`);
            if (node) centerInViewport(node.querySelector('.node-card') || node);
        });
        const actions = document.createElement('span');
        actions.className = 'lk-notes-actions';
        [['Edit', 'bi:pencil', () => editNote(uuid, note.host)],
         ['Delete', 'bi:trash', () => deleteNote(uuid)]].forEach(([label, name, action]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = `${label} this note`;
            button.setAttribute('aria-label', `${label} the note on ${note.host}`);
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'lk-icon');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', iconHref(name));
            svg.appendChild(use);
            button.appendChild(svg);
            button.addEventListener('click', action);
            actions.appendChild(button);
        });
        const head = document.createElement('div');
        head.className = 'lk-notes-head';
        head.append(host, actions);
        // The note, rendered from its Markdown (vitrine sanitizes it)
        const text = document.createElement('vt-markdown');
        text.className = 'lk-vitrine lk-notes-text';
        customElements.whenDefined('vt-markdown').then(() => { text.content = note.text; });
        item.append(head, text);
        list.appendChild(item);
    });
    const count = document.getElementById('tree-notes-count');
    count.hidden = !entries.length;
    count.textContent = entries.length;
    document.getElementById('tree-notes-copy').disabled = !entries.length;
    document.getElementById('tree-notes-download').disabled = !entries.length;
}

function setupNotes() {
    const modal = document.getElementById('noteModal');
    if (!modal) return;
    const editor = document.getElementById('note-markdown');
    editor.addEventListener('vt-input', (event) => { note_text = event.detail.value; });
    document.getElementById('note-modal-save').addEventListener('click', saveNote);
    document.getElementById('note-modal-delete').addEventListener('click', () => {
        if (note_target) deleteNote(note_target.uuid);
        bootstrap.Modal.getOrCreateInstance('#noteModal').hide();
    });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); saveNote(); }
    });
    modal.addEventListener('hidden.bs.modal', () => { note_target = null; });

    const panel = document.getElementById('tree-notes');
    const toggle = document.getElementById('tree-notes-toggle');
    const show = (open) => {
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.classList.toggle('is-active', open);
    };
    toggle.addEventListener('click', () => show(panel.hidden));
    document.getElementById('tree-notes-close').addEventListener('click', () => show(false));
    const copy_button = document.getElementById('tree-notes-copy');
    copy_button.addEventListener('click', () => {
        // js/capture_components.js: says "Copied" / "Copy failed" on the button
        if (window.copyWithFeedback) window.copyWithFeedback(copy_button, notesMarkdown());
        else navigator.clipboard?.writeText(notesMarkdown());
    });
    document.getElementById('tree-notes-download').addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([notesMarkdown()], {type: 'text/markdown'}));
        link.download = `lookyloo-notes-${treeUUID}.md`;
        link.click();
        URL.revokeObjectURL(link.href);
    });
    renderNotes();
}

// ****************** Comparison with another capture ******************

function isNewHost(d) {
    return compare_hosts !== null && !compare_hosts.has(d.data.name);
}

function hostnamesOf(tree_data) {
    const names = new Set();
    (function walk(n) {
        names.add(n.name);
        (n.children || []).forEach(walk);
    })(tree_data);
    return names;
}

// A capture link (with its ?seed= for a private capture) or a bare UUID
function parseCaptureRef(text) {
    const value = text.trim();
    const match = value.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (!match) return null;
    let seed = null;
    try { seed = new URL(value).searchParams.get('seed'); } catch (e) { /* bare UUID */ }
    return {uuid: match[1].toLowerCase(), seed};
}

async function compareWith(ref, label) {
    const error = document.getElementById('tree-compare-error');
    error.hidden = true;
    if (!ref || ref.uuid === treeUUID) {
        error.textContent = ref ? 'That is this capture: choose another one.' : 'Paste the link or the UUID of a capture.';
        error.hidden = false;
        return;
    }
    const query = ref.seed ? `?seed=${encodeURIComponent(ref.seed)}` : '';
    let other;
    try {
        const response = await fetch(`/json/${ref.uuid}/tree_dump${query}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        other = await response.json();
    } catch (e) {
        error.textContent = "This capture can't be loaded (unknown, private without its seed, or not processed yet).";
        error.hidden = false;
        return;
    }
    compare_hosts = hostnamesOf(other);
    const ours = new Set(allNodes(tree_root).map(d => d.data.name));
    const added = [...ours].filter(name => !compare_hosts.has(name));
    const gone = [...compare_hosts].filter(name => !ours.has(name)).sort();

    const with_link = document.getElementById('tree-compare-with');
    with_link.textContent = 'Compared with ';
    const a = document.createElement('a');
    a.href = `/tree/${ref.uuid}${query}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label || ref.uuid;
    with_link.appendChild(a);
    document.getElementById('tree-compare-summary').textContent =
        `${added.length} new host${added.length === 1 ? '' : 's'} in this capture, ${gone.length} gone.`;
    const gone_list = document.getElementById('tree-compare-gone');
    gone_list.textContent = '';
    gone.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        gone_list.appendChild(li);
    });
    if (!gone.length) {
        const li = document.createElement('li');
        li.className = 'lk-compare-empty';
        li.textContent = 'None.';
        gone_list.appendChild(li);
    }
    document.getElementById('tree-compare-choose').hidden = true;
    document.getElementById('tree-compare-result').hidden = false;
    document.getElementById('tree-compare-toggle').classList.add('is-on');
    markPaths();
    applyTreeFilter();
}

function stopComparing() {
    compare_hosts = null;
    compare_only_new = false;
    document.getElementById('tree-compare-only-new').checked = false;
    document.getElementById('tree-compare-choose').hidden = false;
    document.getElementById('tree-compare-result').hidden = true;
    document.getElementById('tree-compare-toggle').classList.remove('is-on');
    markPaths();
    applyTreeFilter();
}

// Other captures of the same URL (index of the URLs), newest first
async function listOtherCaptures() {
    const list = document.getElementById('tree-compare-captures');
    let captures = [];
    try {
        const response = await fetch('/json/url_info', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({url: capture_info.url, limit: 15})});
        captures = ((await response.json()).response || []).filter(c => c.capture_uuid !== treeUUID);
    } catch (e) { /* index unavailable: only the field */ }
    list.textContent = '';
    if (!captures.length) {
        const li = document.createElement('li');
        li.className = 'lk-compare-empty';
        li.textContent = 'No other capture of this URL in the index.';
        list.appendChild(li);
        return;
    }
    captures.forEach(capture => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        const when = new Date(capture.start_timestamp);
        const date = document.createElement('span');
        date.className = 'lk-compare-date';
        date.textContent = isNaN(when) ? capture.start_timestamp : when.toLocaleString();
        const title = document.createElement('span');
        title.textContent = capture.title || capture.capture_uuid;
        button.append(date, title);
        button.addEventListener('click', () => compareWith({uuid: capture.capture_uuid, seed: null}, `the capture of ${date.textContent}`));
        li.appendChild(button);
        list.appendChild(li);
    });
}

function setupCompare() {
    const panel = document.getElementById('tree-compare');
    if (!panel) return;
    const toggle = document.getElementById('tree-compare-toggle');
    let listed = false;
    const show = (open) => {
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.classList.toggle('is-active', open);
        if (open) {
            // One panel at a time
            const notes_panel = document.getElementById('tree-notes');
            if (notes_panel && !notes_panel.hidden) document.getElementById('tree-notes-close').click();
            if (!listed) { listed = true; listOtherCaptures(); }
        }
    };
    toggle.addEventListener('click', () => show(panel.hidden));
    document.getElementById('tree-compare-close').addEventListener('click', () => show(false));
    document.getElementById('tree-compare-form').addEventListener('submit', (event) => {
        event.preventDefault();
        compareWith(parseCaptureRef(document.getElementById('tree-compare-input').value));
    });
    document.getElementById('tree-compare-stop').addEventListener('click', stopComparing);
    document.getElementById('tree-compare-only-new').addEventListener('change', (event) => {
        compare_only_new = event.target.checked;
        applyTreeFilter();
    });
    // Opening the notes closes this panel
    document.getElementById('tree-notes-toggle').addEventListener('click', () => {
        if (!panel.hidden) show(false);
    });
}

// Put a floating element of the tree area next to an element of the tree
function placeNextTo(floating, anchor) {
    const area = floating.parentElement.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    let left = box.right - area.left + 12;
    if (left + floating.offsetWidth > area.width - 8) left = Math.max(8, box.left - area.left - floating.offsetWidth - 12);
    const top = Math.min(Math.max(8, box.top - area.top), area.height - floating.offsetHeight - 8);
    floating.style.left = `${left}px`;
    floating.style.top = `${top}px`;
}

let info_timer = null;
function showNodeInfo(event, d) {
    clearTimeout(info_timer);
    const panel = document.getElementById('tree-node-info');
    if (!panel) return;
    const card = event.currentTarget.querySelector('.node-card');
    info_timer = setTimeout(() => {
        panel.textContent = '';
        const title = document.createElement('p');
        title.className = 'lk-node-info-title';
        title.textContent = d.data.idna || d.data.name;
        if (d.data.third_party) {
            const flag = document.createElement('span');
            flag.className = 'lk-node-info-flag';
            flag.textContent = 'third party';
            title.appendChild(flag);
        }
        panel.appendChild(title);
        const lines = networkLines(d);
        const table = document.createElement('dl');
        (lines.length ? lines : [['DNS', 'No DNS data in this capture']]).forEach(([label, value]) => {
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = value;
            table.append(dt, dd);
        });
        panel.appendChild(table);
        if (notes[d.data.uuid]) {
            const note = document.createElement('p');
            note.className = 'lk-node-info-note';
            note.textContent = notes[d.data.uuid].text;
            panel.appendChild(note);
        }
        // Next to the card, inside the tree area
        panel.hidden = false;
        placeNextTo(panel, card || event.currentTarget);
    }, 500);
}
function hideNodeInfo() {
    clearTimeout(info_timer);
    const panel = document.getElementById('tree-node-info');
    if (panel) panel.hidden = true;
}

// Links and nodes of the main path, and of the path to the hovered node
function markPaths() {
    node_container.selectAll('g.node')
        .classed('is-new-host', d => isNewHost(d))
        .classed('is-main-path', d => main_path.has(d.data.uuid))
        .classed('has-note', d => Boolean(notes[d.data.uuid]));
    node_container.selectAll('path.link').classed('is-main-path', l => main_path.has(l.data.uuid));
}
function showHoverPath(d) {
    const path = new Set(d ? d.ancestors().map(a => a.data.uuid) : []);
    node_container.selectAll('path.link').classed('is-hover-path', l => path.has(l.data.uuid));
}


function setupAttention(root) {
    const container = document.getElementById('tree-alerts');
    if (!container) return;
    const all = allNodes(root);
    ATTENTION.forEach(item => {
        const count = all.filter(d => nodeHas(d, item.key)).length;
        if (!count) return;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `lk-tree-alert lk-tree-alert-${item.level}`;
        chip.dataset.key = item.key;
        chip.title = `${item.title}. Click to filter the tree.`;
        chip.setAttribute('aria-pressed', 'false');
        const number = document.createElement('strong');
        number.textContent = count;
        chip.append(number, ` ${item.label}`);
        chip.addEventListener('click', () => toggleLegendFilter(item.key));
        container.appendChild(chip);
    });
    container.hidden = !container.children.length;
}

// ****************** Entry animation ******************

// The nodes start on the root and move to their place, depth after depth; the
// links fade in once their node has arrived. Resolves when it is over.
function animateTreeEntry(root) {
    tree_entry_done = true;
    if (reduce_motion) return Promise.resolve();
    const nodes = node_container.selectAll('g.node');
    const links = node_container.selectAll('path.link');
    nodes.interrupt()
        .attr('opacity', 0)
        .attr('transform', nodeTransform(root));
    links.interrupt().attr('opacity', 0);
    const moved = nodes.transition('entry')
        .delay(d => d.depth * ENTRY_STEP_MS)
        .duration(ENTRY_MOVE_MS)
        .ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .attr('transform', d => nodeTransform(d))
        .end();
    const shown = links.transition('entry')
        .delay(d => d.depth * ENTRY_STEP_MS + ENTRY_MOVE_MS * 0.6)
        .duration(ENTRY_MOVE_MS)
        .attr('opacity', 1)
        .end();
    return Promise.all([moved, shown]).catch(() => {});
}

// ****************** Legend & icon filter (tree/legend.html) ******************

// Does the node have this icon? Same test as icon_list(): true, a non-empty
// string, a number > 0 or a non-empty list.
function nodeHas(d, key) {
    const value = d.data[key];
    if (value instanceof Array) return value.length > 0;
    if (typeof value === 'number') return value > 0;
    return Boolean(value);
}

// Text searched in a node: hostname, IDNA form, resolved IPs
function nodeText(d) {
    const parts = [d.data.name, d.data.idna];
    const ips = d.data.resolved_ips;
    if (ips && typeof ips === 'object') {
        // v4 / v6: a list of IPs, or an object keyed by IP, or null
        Object.values(ips).forEach(list => {
            if (list instanceof Array) parts.push(...list.map(String));
            else if (list && typeof list === 'object') parts.push(...Object.keys(list));
        });
    }
    return parts.filter(Boolean).join(' ').toLowerCase();
}

// The filters of the tree: icons (legend) AND text (search field). A node
// matches when it passes every active filter; the others are dimmed.
// The focused node, its parent or one of its children
function isNeighbour(d) {
    if (d.data.uuid === focus_uuid) return true;
    if (d.parent && d.parent.data.uuid === focus_uuid) return true;
    return (d.children || []).some(child => child.data.uuid === focus_uuid);
}

function nodeMatches(d) {
    const icon_ok = active_filters.size === 0 || [...active_filters].some(key => nodeHas(d, key));
    const text_ok = !search_text || nodeText(d).includes(search_text);
    const focus_ok = !focus_uuid || isNeighbour(d);
    const compare_ok = !compare_only_new || isNewHost(d);
    return icon_ok && text_ok && focus_ok && compare_ok;
}

function matchingNodes() {
    return node_container.selectAll('g.node').filter(d => nodeMatches(d)).nodes();
}

function applyTreeFilter() {
    const filtering = active_filters.size > 0 || search_text !== '' || focus_uuid !== null || compare_only_new;
    let matches = 0;
    node_container.selectAll('g.node').each(function(d) {
        const match = filtering && nodeMatches(d);
        if (match) matches++;
        d3.select(this)
          .classed('is-filter-match', match)
          .classed('is-filter-dimmed', filtering && !match)
          .classed('is-focused', d.data.uuid === focus_uuid);
    });
    // A link stays lit when both its ends do (its datum is the child node)
    node_container.selectAll('path.link')
        .classed('is-filter-dimmed', l => filtering && !(nodeMatches(l) && nodeMatches(l.parent)));
    const label = `${matches} node${matches === 1 ? '' : 's'}`;
    const active = document.getElementById('legend-active');
    if (active) {
        active.hidden = active_filters.size === 0;
        active.textContent = active_filters.size ? label : '';
    }
    const clear = document.getElementById('legend-clear');
    if (clear) clear.hidden = active_filters.size === 0;
    const count = document.getElementById('tree-search-count');
    if (count) {
        count.textContent = search_text ? (matches ? label : 'No match') : '';
        document.getElementById('tree-search-prev').hidden = !search_text || matches < 2;
        document.getElementById('tree-search-next').hidden = !search_text || matches < 2;
    }
    return matches;
}

// Centre the next / previous matching node in the viewport
function focusMatch(step) {
    const nodes = matchingNodes();
    if (!nodes.length) return;
    search_index = (search_index + step + nodes.length) % nodes.length;
    const node = nodes[search_index];
    centerInViewport(node);
    node_container.selectAll('g.node').classed('is-search-current', false);
    d3.select(node).classed('is-search-current', true);
    const count = document.getElementById('tree-search-count');
    if (count && nodes.length > 1) count.textContent = `${search_index + 1} / ${nodes.length}`;
}

// New capture of the host of a node, with the settings of this capture (POST
// /bulk_captures: same browser, user agent, cookies; this capture is its parent).
// The list of the new captures opens in a new tab.
function captureHost(d) {
    const scheme = d.data.https_content || !d.data.http_content ? 'https' : 'http';
    const form = document.createElement('form');
    form.method = 'post';
    form.action = `/bulk_captures/${treeUUID}${document.location.search}`;
    form.target = '_blank';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'user_urls';
    input.value = `${scheme}://${d.data.name}/`;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    form.remove();
}

// Sprite of the site icons, to draw them in the tree. name: 'bi:camera', quoted
// like in the templates so tools/build_icons.py finds it and puts it in the sprite.
function iconHref(name) {
    const any = document.querySelector('svg.lk-icon use');
    const sprite = any ? any.getAttribute('href').split('#')[0] : '';
    return `${sprite}#${name.replace(':', '-').replace('/', '-')}`;
}

// Click on a card: focus the node and its neighbours; again on it: show everything
function toggleNeighbours(d) {
    focus_uuid = focus_uuid === d.data.uuid ? null : d.data.uuid;
    const pill = document.getElementById('tree-focus');
    if (pill) {
        pill.hidden = focus_uuid === null;
        document.getElementById('tree-focus-name').textContent = focus_uuid ? (d.data.idna || d.data.name) : '';
    }
    applyTreeFilter();
}

function clearNeighbours() {
    if (focus_uuid === null) return;
    focus_uuid = null;
    document.getElementById('tree-focus').hidden = true;
    applyTreeFilter();
}

// ****************** Tree controls: orientation, collapse / expand all ******************

// Expanding more nodes than this at once would make the page too slow
const MAX_EXPANDED_NODES = 400;

// Every node, shown or collapsed
function allNodes(root) {
    const nodes = [];
    (function walk(d) {
        nodes.push(d);
        (d.children || d._children || []).forEach(walk);
    })(root);
    return nodes;
}

function controlsStatus(message) {
    const status = document.getElementById('tree-controls-status');
    status.textContent = message;
    status.hidden = false;
    clearTimeout(controlsStatus.timer);
    controlsStatus.timer = setTimeout(() => { status.hidden = true; }, 5000);
}

function relayout() {
    update(tree_root);
    // Centre the root once the nodes have moved (300 ms transition)
    setTimeout(() => {
        const root_node = document.getElementById(`node_${tree_root.data.uuid}`);
        if (root_node) centerInViewport(root_node.querySelector('.node-card') || root_node);
    }, reduce_motion ? 0 : 350);
}

function showOrientation() {
    const button = document.getElementById('tree-orientation');
    const label = orientation === 'horizontal' ? 'Draw the tree from top to bottom' : 'Draw the tree from left to right';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.classList.toggle('is-vertical', orientation === 'vertical');
}

function setupTreeControls() {
    const orientation_button = document.getElementById('tree-orientation');
    if (!orientation_button) return;
    showOrientation();
    orientation_button.addEventListener('click', () => {
        orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
        try { localStorage.setItem('lk-tree-orientation', orientation); } catch (e) { /* not remembered */ }
        showOrientation();
        relayout();
        applyBackground();
    });

    // Collapse every node but the root: the first level stays visible
    document.getElementById('tree-collapse-all').addEventListener('click', () => {
        allNodes(tree_root).forEach(d => {
            if (d === tree_root) {
                d.children = d.children || d._children;
                d._children = null;
            } else if (d.children) {
                d._children = d.children;
                d.children = null;
            }
        });
        relayout();
    });

    // Expand level after level, as long as the tree stays under MAX_EXPANDED_NODES
    document.getElementById('tree-expand-all').addEventListener('click', () => {
        let shown = tree_root.descendants().length;
        let level = tree_root.descendants().filter(d => d._children);
        let stopped = false;
        while (level.length) {
            const added = level.reduce((sum, d) => sum + allNodes(d).length - 1, 0);
            if (shown + added > MAX_EXPANDED_NODES) {
                // Only the next level of this one, if it still fits
                const next = level.reduce((sum, d) => sum + d._children.length, 0);
                if (shown + next > MAX_EXPANDED_NODES) { stopped = true; break; }
                level.forEach(d => { d.children = d._children; d._children = null; });
                shown += next;
                level = level.flatMap(d => d.children.filter(c => c._children));
                continue;
            }
            level.forEach(d => allNodes(d).forEach(n => {
                if (n._children) { n.children = n._children; n._children = null; }
            }));
            shown += added;
            break;
        }
        relayout();
        const total = allNodes(tree_root).length;
        if (stopped || shown < total) {
            controlsStatus(`${shown} of ${total} nodes shown: expanding all of them would slow the page down. Expand the others one by one.`);
        }
    });
}

// Position of the tooltip of the tree: page coordinates, or screen coordinates in
// full screen (the tooltip is then fixed, inside the full screen element)
function tipX(event) { return document.fullscreenElement ? event.clientX : event.pageX; }
function tipY(event) { return document.fullscreenElement ? event.clientY : event.pageY; }

// ****************** Background of the tree area ******************

// plain, dots, grid or columns (one band per depth, following the orientation);
// drawn by css/tree.css on #tree_viewport, remembered in localStorage
const BACKGROUNDS = ['plain', 'dots', 'grid', 'columns'];
let background_choice = 'plain';
try {
    const saved = localStorage.getItem('lk-tree-background');
    if (BACKGROUNDS.includes(saved)) background_choice = saved;
} catch (e) { /* storage unavailable */ }

function applyBackground() {
    BACKGROUNDS.forEach(name => tree_viewport.classList.toggle(`lk-tree-bg-${name}`, name === background_choice));
    tree_viewport.classList.toggle('is-vertical', orientation === 'vertical');
    document.querySelectorAll('[data-tree-background]').forEach(item => {
        const on = item.dataset.treeBackground === background_choice;
        item.setAttribute('aria-pressed', on ? 'true' : 'false');
        item.classList.toggle('active', on);
    });
}

// Size and offset of the depth columns / rows, from the layout (update())
function setColumnsGeometry(size, offset) {
    tree_viewport.style.setProperty('--lk-tree-band', `${size}px`);
    tree_viewport.style.setProperty('--lk-tree-band-offset', `${offset}px`);
}

function setupBackground() {
    document.querySelectorAll('[data-tree-background]').forEach(item => {
        item.addEventListener('click', () => {
            background_choice = item.dataset.treeBackground;
            try { localStorage.setItem('lk-tree-background', background_choice); } catch (e) { /* not kept */ }
            applyBackground();
        });
    });
    applyBackground();
}

// ****************** Full screen: only the tree area ******************

function setupFullscreen() {
    const button = document.getElementById('tree-fullscreen');
    const area = document.querySelector('.lk-tree-area');
    if (!button || !area) return;
    if (!document.fullscreenEnabled) {
        button.hidden = true;
        return;
    }
    button.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else area.requestFullscreen().catch(() => { /* refused by the browser */ });
    });
    document.addEventListener('fullscreenchange', () => {
        const on = document.fullscreenElement === area;
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
        const label = on ? 'Leave full screen (Esc)' : 'Show only the tree, full screen';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.classList.toggle('is-fullscreen', on);
        // The tooltip of the tree must be inside the full screen element to be seen
        const tooltip = document.getElementById('tooltip');
        if (tooltip) (on ? area : document.body).appendChild(tooltip);
        hideNodeInfo();
    });
}

function setupTreeSearch() {
    document.getElementById('tree-focus-clear')?.addEventListener('click', clearNeighbours);
    // Click on the background of the tree, or Esc outside a field: show everything
    main_svg.on('click', (event) => {
        if (event.target === main_svg.node() || event.target.classList?.contains('tree-background')) clearNeighbours();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || document.querySelector('.modal.show')) return;
        if (document.activeElement?.tagName === 'INPUT') return;
        clearNeighbours();
    });

    const input = document.getElementById('tree-search');
    if (!input) return;
    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            search_text = input.value.trim().toLowerCase();
            search_index = -1;
            node_container.selectAll('g.node').classed('is-search-current', false);
            if (applyTreeFilter() && search_text) focusMatch(1);
        }, 150);
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            focusMatch(event.shiftKey ? -1 : 1);
        } else if (event.key === 'Escape') {
            input.value = '';
            input.dispatchEvent(new Event('input'));
            input.blur();
        }
    });
    document.getElementById('tree-search-next').addEventListener('click', () => focusMatch(1));
    document.getElementById('tree-search-prev').addEventListener('click', () => focusMatch(-1));
    // "/" anywhere on the page (outside a field) focuses the search
    document.addEventListener('keydown', (event) => {
        if (event.key !== '/' || event.ctrlKey || event.metaKey) return;
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        if (document.querySelector('.modal.show')) return;
        event.preventDefault();
        input.focus();
        input.select();
    });
}

// Select / unselect an icon in the filter: from the legend, or from an icon of a node
function toggleLegendFilter(key) {
    const button = document.querySelector(`.lk-legend-item[data-key="${key}"]`);
    if (!button || button.disabled) return;
    if (active_filters.has(key)) active_filters.delete(key);
    else active_filters.add(key);
    button.setAttribute('aria-pressed', active_filters.has(key) ? 'true' : 'false');
    document.querySelectorAll(`.lk-tree-alert[data-key="${key}"]`)
        .forEach(chip => chip.setAttribute('aria-pressed', active_filters.has(key) ? 'true' : 'false'));
    // Show the legend, so the filter can be seen and cleared
    document.getElementById('legend').open = true;
    applyTreeFilter();
}

function setupLegendFilter(root) {
    const present = document.getElementById('legend-present');
    if (!present) return;
    const absent = document.getElementById('legend-absent');
    const nodes = root.descendants();
    let absent_count = 0;
    present.querySelectorAll('.lk-legend-item').forEach(button => {
        const key = button.dataset.key;
        const count = nodes.filter(d => nodeHas(d, key)).length;
        button.querySelector('.lk-legend-count').textContent = count;
        if (count === 0) {
            // Icons that are not in this capture: in the collapsed "Not in this capture"
            button.disabled = true;
            absent.appendChild(button.closest('li'));
            absent_count++;
            return;
        }
        button.title = `${button.title}: ${count} of ${nodes.length} nodes`;
        button.addEventListener('click', () => toggleLegendFilter(key));
    });
    // Most frequent first
    [...present.children]
        .sort((a, b) => b.querySelector('.lk-legend-count').textContent - a.querySelector('.lk-legend-count').textContent)
        .forEach(li => present.appendChild(li));
    document.getElementById('legend-absent-count').textContent = absent_count;
    document.getElementById('legend-absent-panel').hidden = absent_count === 0;
    document.getElementById('legend-clear').addEventListener('click', () => {
        active_filters.clear();
        present.querySelectorAll('.lk-legend-item').forEach(b => b.setAttribute('aria-pressed', 'false'));
        document.querySelectorAll('.lk-tree-alert').forEach(c => c.setAttribute('aria-pressed', 'false'));
        applyTreeFilter();
    });
}

function open_hostnode_popup(hostnode_uuid) {
    // /tree is kept, append the paramaters (seed, if present)
    let win = window.open(`/tree/${treeUUID}/host/${hostnode_uuid}${document.location.search}`, '_blank', 'width=1024,height=768,left=200,top=100');
    if (win == null) {
        alert("The browser didn't allow Lookyloo to open a pop-up. There should be an icon on the right of your URL bar to allow it.");
    }
    win.focus();
}

function UnbookmarkAllNodes() {
    d3.selectAll('.node_data').classed('is-bookmarked', false);
    d3.selectAll('.node_data').select("#bookmark")
        .text("🏁")
        .on('click', (event, d) => NodeHighlight(d.data.uuid))
        .on('mouseover', (event, d) => {
            d3.select('#tooltip')
                .style('opacity', 1)
                .style('left', `${tipX(event) + 10}px`)
                .style('top', `${tipY(event) + 10}px`)
                .text('Bookmark this node');
        })
        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
};

function MarkAsKnown(capture_uuid, hostnode_uuid=null, urlnode_uuid=null) {
  let data = {};
  if (hostnode_uuid != null) { data['hostnode_uuid'] = hostnode_uuid; };
  if (urlnode_uuid != null) { data['urlnode_uuid'] = urlnode_uuid; };
  $.post(`/tree/${capture_uuid}/mark_as_legitimate`, data);
};

function UnbookmarkHostNode(hostnode_uuid) {
    d3.select(`#node_${hostnode_uuid}`).select('.node_data').classed('is-bookmarked', false);
    d3.select(`#node_${hostnode_uuid}`).select("#bookmark")
        .text("🏁")
        .on('click', (event, d) => NodeHighlight(d.data.uuid))
        .on('mouseover', (event, d) => {
            d3.select('#tooltip')
                .style('opacity', 1)
                .style('left', `${tipX(event) + 10}px`)
                .style('top', `${tipY(event) + 10}px`)
                .text('Bookmark this node');
        })
        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
};

function NodeHighlight(hostnode_uuid) {
    let element = document.getElementById(`node_${hostnode_uuid}`);
    centerInViewport(element);

    d3.select(`#node_${hostnode_uuid}`).select('.node_data').classed('is-bookmarked', true);
    d3.select(`#node_${hostnode_uuid}`).select("#bookmark")
        .text('❌')
        .on('click', (event, d) => UnbookmarkHostNode(d.data.uuid))
        .on('mouseover', (event, d) => {
            d3.select('#tooltip')
                .style('opacity', 1)
                .style('left', `${tipX(event) + 10}px`)
                .style('top', `${tipY(event) + 10}px`)
                .text('Remove bookmark on this node');
        })
        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
};

function icon_list(relative_x_pos, relative_y_pos, d) {
    const icon_size = 16;
    const icon_options = new Map([
        ['js', {path: "/static/images/icons/javascript.png", tooltip: "URL(s) loading Javascript"}],
        ['exe', {path: "/static/images/icons/exe.png", tooltip: "URL(s) loading executables"}],
        ['css', {path: "/static/images/icons/css.png", tooltip: "URL(s) loading CSS"}],
        ['font', {path: "/static/images/icons/font.png", tooltip: "URL(s) loading fonts"}],
        ['html', {path: "/static/images/icons/html.png", tooltip: "URL(s) loading HTML"}],
        ['json', {path: "/static/images/icons/json.png", tooltip: "URL(s) loading Json"}],
        ['iframe', {path: "/static/images/icons/ifr.png", tooltip: "URL(s) loaded from an Iframe"}],
        ['image', {path: "/static/images/icons/img.png", tooltip: "URL(s) loading images"}],
        ['unknown_mimetype', {path: "/static/images/icons/wtf.png", tooltip: "URL(s) loading contents of an unknown type"}],
        ['video', {path: "/static/images/icons/video.png", tooltip: "URL(s) loading videos"}],
        ['request_cookie', {path: "/static/images/icons/cookie_read.png", tooltip: "cookie(s) sent to the server in the request"}],
        ['response_cookie', {path: "/static/images/icons/cookie_received.png", tooltip: "cookie(s) received in the response"}],
        ['redirect', {path: "/static/images/icons/redirect.png", tooltip: "redirect(s)"}],
        ['redirect_to_nothing', {path: "/static/images/icons/cookie_in_url.png", tooltip: "redirect(s) to URL(s) missing in the capture"}],
        ['empty', {path: "/static/images/icons/empty.svg", tooltip: "URL(s) returning no content"}],
        ['downloaded_filename', {path: "/static/images/icons/download.png", tooltip: "contains a downloaded file."}],
        ['websocket_session', {path: "/static/images/icons/websocket.svg", tooltip: "contains a websocket session."}],
        ['posted_data', {path: "/static/images/icons/send-arrow-up.svg", tooltip: "POSTs content."}]
    ]);

    // Put all the icone in one sub svg document
    let icons = d3.create("svg")
          .attr('x', relative_x_pos)
          .attr('y', relative_y_pos)
          .attr('class', 'icons_list');

    icon_options.forEach(function(icon_details, key) {
        let has_icon = false;
        let counter = 0;
        if (typeof d.data[key] === 'boolean') {
          has_icon = d.data[key];
        } else if (typeof d.data[key] === 'string') {
            has_icon = d.data[key];
        } else if (typeof d.data[key] === 'number') {
          has_icon = d.data[key] > 0;
          counter = d.data[key];
        } else if (d.data[key] instanceof Array) {
          has_icon = d.data[key].length > 0;
          counter = d.data[key].length;
        };
        if (has_icon) {
          let icon_group = icons
                .append("svg")
                .attr('class', 'icon')
                .attr("id", `icons_${key}`);
          // Light chip behind the PNG (visible in dark mode only, --lk-color-tree-icon-bg)
          icon_group
              .append('rect')
              .attr('class', 'node-icon-chip')
              .attr('x', 0)
              .attr('y', 0)
              .attr('rx', 3)
              .attr('width', icon_size + 2)
              .attr('height', icon_size + 2);
          icon_group
              .append('image')
              .attr('x', 1)
              .attr('y', 1)
              .attr("width", icon_size)
              .attr("height", icon_size)
              .attr("xlink:href", icon_details.path)
              .attr('cursor', 'pointer')
              .on('click', () => toggleLegendFilter(key))
              .on('mouseover', (event, d) => {
                  d3.select('#tooltip')
                      .style('opacity', 1)
                      .style('left', `${tipX(event) + 10}px`)
                      .style('top', `${tipY(event) + 10}px`)
                      .text(`${counter ? `${counter} ${icon_details.tooltip}` : icon_details.tooltip}. Click to filter the nodes.`);
              })
              .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
          if (counter > 0) {
            icon_group
                .append('text')
                .attr('class', 'node-icon-count')
                .attr("dy", 11)
                .attr('x', icon_size + 4)
                .text(counter);
          };
        };
    })
    return icons.node();
}

function text_entry(relative_x_pos, relative_y_pos, d) {
    // Avoid hiding the content after the circle
    let nodeContent = d3.create("svg")  // WARNING: svg is required there, "g" doesn't have getBBox
          .attr('height', node_height)
          .attr('x', relative_x_pos)
          .attr('y', relative_y_pos)
          .datum(d);

    // Add labels for the nodes
    nodeContent.append("text")
          .attr('class', 'node-host')
          .attr('dy', '.9em')
          .attr('cursor', 'pointer')
          .on('click', (event, d) => open_hostnode_popup(d.data.uuid))
          .on('mouseover', (event, d) => {
              d3.select('#tooltip')
                  .style('opacity', 1)
                  .style('left', `${tipX(event) + 10}px`)
                  .style('top', `${tipY(event) + 10}px`)
                  .text('Open investigation pop-up.');
          })
          .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0))
          .text(d => {
            let to_print;
            if (d.data.idna) {
                to_print = d.data.idna;
            }
            else if (d.data.name.length > 50) {
                to_print = `[...] ${d.data.name.substring(d.data.name.length - 50, d.data.name.length)}`;
            } else {
                to_print = d.data.name
            };
            return to_print;
          });

    if (d.data.idna) {
    nodeContent.append("text")
          .attr('class', 'node-host-idna')
          .attr('dy', '2.6em')
          .attr('dx', '2em')
          .attr('cursor', 'pointer')
          .on('click', (event, d) => open_hostnode_popup(d.data.uuid))
          .on('mouseover', (event, d) => {
              d3.select('#tooltip')
                  .style('opacity', 1)
                  .style('left', `${tipX(event) + 10}px`)
                  .style('top', `${tipY(event) + 10}px`)
                  .text('Open investigation pop-up.');
          })
          .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0))
          .text(d => { return d.data.name }
      );
    }

    return nodeContent.node();
}

// Recursively generate the tree
function update(root, computed_node_width=0) {

  // Current height of the tree (cannot use height because it isn't recomputed when we rename children -> _children)
  let max_depth = 0
  root.each(d => {
    if (d.children){
      max_depth = d.depth > max_depth ? d.depth : max_depth;
    }
  });

  if (computed_node_width != 0) {
    computed_node_width += 30;
    let svgWidth, svgHeight, pageWidth, pageHeight;
    if (orientation === 'horizontal') {
      // One column per depth, one line per node
      svgWidth = Math.max((max_depth + 1) * computed_node_width, node_width);
      svgHeight = Math.max(root.descendants().length * node_height, min_height);
      tree.size([svgHeight, svgWidth]);
      pageWidth = svgWidth + (margin.right + margin.left) * 2;
      pageHeight = svgHeight + margin.top + margin.bottom;
      pattern.attr('width', computed_node_width * 2).attr('height', pageHeight);
      pattern.select('rect').attr('width', computed_node_width).attr('height', pageHeight);
      setColumnsGeometry(computed_node_width, margin.left);
    } else {
      // One row per depth, one column (the widest card) per leaf
      svgWidth = Math.max(root.leaves().length * computed_node_width, min_width);
      svgHeight = Math.max((max_depth + 1) * VERTICAL_ROW, min_height);
      tree.size([svgWidth, svgHeight]);
      pageWidth = svgWidth + margin.left + margin.right + computed_node_width;
      pageHeight = svgHeight + margin.top + margin.bottom + VERTICAL_ROW;
      pattern.attr('width', pageWidth).attr('height', VERTICAL_ROW * 2);
      pattern.select('rect').attr('width', pageWidth).attr('height', VERTICAL_ROW);
      setColumnsGeometry(svgHeight / Math.max(max_depth, 1), margin.top - 40);
    }

    // Transparent background rect (css/tree.css), reused by every update: it only
    // catches the clicks on the background (the tree area has a plain colour)
    let background = main_svg.select('rect.tree-background');
    if (background.empty()) {
      background = main_svg.insert('rect', ':first-child')
        .attr('class', 'tree-background');
    }
    background.attr('y', 0).attr('width', pageWidth).attr('height', pageHeight);
    // Vertical rows start under the top margin, aligned on the cards
    pattern.attr('x', orientation === 'horizontal' ? margin.left : 0)
           .attr('y', orientation === 'horizontal' ? 0 : margin.top - 40 - VERTICAL_ROW / 4);

    main_svg.attr("width", pageWidth).attr("height", pageHeight);
    document.getElementById('tree_svg').style.width = `${Math.max(pageWidth, min_width)}px`;
    document.getElementById('tree_svg').style.height = `${Math.max(pageHeight, min_height)}px`;
  }

  // Assigns the x and y position for the nodes
  let treemap = tree(root);

  // Compute the new tree layout. => Note: Need d.x & d.y
  let nodes = treemap.descendants(),
      links = treemap.descendants().slice(1);

  // ****************** Nodes section ***************************

  // Toggle children on click.
  let toggle_children_collapse = (event, d) => {
    if (d.children) {
        d._children = d.children;
        d.children = null;
    }
    else {
        d.children = d._children;
        d._children = null;
    }
    // Call update on the whole Tree
    update(d.ancestors().reverse()[0]);
  };

  // Update the nodes...
  const tree_nodes = node_container.selectAll('g.node')
      .data(nodes, node => node.data.uuid);

  tree_nodes.join(
        // Enter any new modes at the parent's previous position.
        enter => {
            let node_group = enter.append('g')
                .attr('class', d => d.data.third_party ? 'node is-third-party' : 'node')
                .on('mouseenter', (event, d) => { showHoverPath(d); showNodeInfo(event, d); })
                .on('mouseleave', () => { showHoverPath(null); hideNodeInfo(); })
                .on('mousedown', hideNodeInfo)
                .attr("id", d => `node_${d.data.uuid}`)
                .attr("transform", nodeTransform(root, true));

            let node_data = node_group
              .append('svg')
              .attr('class', 'node_data')
              .attr('x', 0)
              .attr('y', -30);

            node_data.append('rect')
              .attr('class', 'node-card')
              .on('click', (event, d) => toggleNeighbours(d))
              .attr("rx", 8)
              .attr("ry", 8)
              .attr('x', 0)
              .attr('y', 0)
              .attr('width', 10)

            // Set Hostname text
            node_data
              .append(d => text_entry(10, 5, d));  // Popup
            // Set list of icons
            node_data
              .append(d => icon_list(12, 35, d));

            node_group.select('.node_data').each(function(d){
                // set position of icons based of their length
                let cur_icon_list_len = 0;
                d3.select(this).selectAll('.icon').each(function(){
                    d3.select(this).attr('x', cur_icon_list_len);
                    cur_icon_list_len += d3.select(this).node().getBBox().width + 6;
                });

                // Rectangle around the domain name & icons
                d3.select(this).select('rect')
                  .attr('height', node_height + 5)
                  .attr('width', d3.select(this).node().getBBox().width + 60);

                // Set the width for all the nodes
                // Required, as the node width need to include the rectangle
                // Note: removing .select('rect') breaks rendering on firefox but not on chrome.
                let selected_node_bbox = d3.select(this).select('rect').node().getBBox();
                d.node_width = selected_node_bbox.width;

                // Third-party host: a coloured bar on the left edge of the card
                if (d.data.third_party) {
                    d3.select(this).insert('rect', '.node-card + *')
                        .attr('class', 'node-third-party-bar')
                        .attr('x', 0).attr('y', 0)
                        .attr('width', 4).attr('height', node_height + 5)
                        .attr('rx', 2);
                }
                node_width = node_width > selected_node_bbox.width ? node_width : selected_node_bbox.width;

                // Set number of URLs after the hostname
                if (d.data.urls_count > 1) {
                    d3.select(this).append("text")
                        .attr('x', d => d3.select(this).select('text').node().getBBox().width + 13)
                        .attr('class', 'node-count')
                        .attr('y', 5)
                        .attr('dy', '.9em')
                        .on('mouseover', (event, d) => {
                            d3.select('#tooltip')
                                .style('opacity', 1)
                                .style('left', `${tipX(event) + 10}px`)
                                .style('top', `${tipY(event) + 10}px`)
                                .text(`This node contains ${d.data.urls_count} URLs.`);
                        })
                        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0))
                        .text(d => {
                            return `(${d.data.urls_count})`;
                        });
                };

                // Set Bookmark
                if (enable_bookmark) {
                    d3.select(this).append("text")
                        .attr('x', `${selected_node_bbox.width - 12}px`)
                        .attr('y', '20px')
                        .attr('class', 'node-bookmark')
                        .attr("id", "bookmark")
                        .text("🏁")
                        .attr('cursor', 'pointer')
                        .on('click', (event, d) => NodeHighlight(d.data.uuid))
                        .on('mouseover', (event, d) => {
                            d3.select('#tooltip')
                                .style('opacity', 1)
                                .style('left', `${tipX(event) + 10}px`)
                                .style('top', `${tipY(event) + 10}px`)
                                .text('Bookmark this node');
                        })
                        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
                };

                // New capture of the host: camera at the top right of the card, shown on hover
                const capture_button = d3.select(this).append('g')
                    .attr('class', 'node-capture')
                    .attr('transform', `translate(${selected_node_bbox.width - (enable_bookmark ? 50 : 30)}, 5)`)
                    .attr('cursor', 'pointer')
                    .attr('role', 'button')
                    .on('click', (event, d) => { event.stopPropagation(); captureHost(d); })
                    .on('mouseover', (event, d) => {
                        d3.select('#tooltip')
                            .style('opacity', 1)
                            .style('left', `${tipX(event) + 10}px`)
                            .style('top', `${tipY(event) + 10}px`)
                            .text(`New capture of ${d.data.name}, with the settings of this capture`);
                    })
                    .on('mouseout', () => d3.select('#tooltip').style('opacity', 0));
                capture_button.append('rect').attr('width', 22).attr('height', 22).attr('rx', 5);
                // Note of the analyst: pencil next to the camera (shown on hover, kept when there is a note)
                const note_button = d3.select(this).append('g')
                    .attr('class', 'node-capture node-note')
                    .attr('transform', `translate(${selected_node_bbox.width - (enable_bookmark ? 50 : 30) - 26}, 5)`)
                    .attr('cursor', 'pointer')
                    .attr('role', 'button')
                    .on('click', (event, d) => { event.stopPropagation(); editNote(d.data.uuid, d.data.idna || d.data.name); })
                    .on('mouseover', (event, d) => {
                        d3.select('#tooltip')
                            .style('opacity', 1)
                            .style('left', `${tipX(event) + 10}px`)
                            .style('top', `${tipY(event) + 10}px`)
                            .text(notes[d.data.uuid] ? 'Edit your note on this node' : 'Write a note on this node');
                    })
                    .on('mouseout', () => d3.select('#tooltip').style('opacity', 0));
                note_button.append('rect').attr('width', 22).attr('height', 22).attr('rx', 5);
                note_button.append('use')
                    .attr('href', iconHref('bi:pencil'))
                    .attr('x', 4).attr('y', 4).attr('width', 14).attr('height', 14);
                capture_button.append('use')
                    .attr('href', iconHref('bi:camera'))
                    .attr('x', 4).attr('y', 4).attr('width', 14).attr('height', 14);

                const thumbnail_size = 64;
                if (d.data.contains_rendered_urlnode) {
                  center_node = d.data.uuid;
                  if (favicon) {
                    // Chip behind the favicon: a dark favicon stays visible in dark mode
                    d3.select(this).append('rect')
                      .attr('class', 'node-icon-chip node-favicon-chip')
                      .attr('x', selected_node_bbox.width/6 - 3)
                      .attr('y', node_height - 4)
                      .attr('rx', 6)
                      .attr('width', 38)
                      .attr('height', 38);
                    d3.select(this).append('image')
                      .attr('x', selected_node_bbox.width/6)
                      .attr('y', node_height - 1)
                      .attr('id', 'favicon')
                      .attr("width", 32)
                      .attr("height", 32)
                      .attr("xlink:href", `data:${mime_favicon};base64,${favicon}`)
                      .attr('cursor', 'pointer')
                      .on('mouseover', (event, d) => {
                          d3.select('#tooltip')
                            .style('opacity', 1)
                            .style('left', `${tipX(event) + 10}px`)
                            .style('top', `${tipY(event) + 10}px`)
                            .text('Potential favicon.');
                      });
                  }
                  d3.select(this).append("svg").append('rect')
                    .attr('x', selected_node_bbox.width/2)
                    .attr('y', node_height - 3)
                    .attr('class', 'node-thumb-frame')
                    .attr('width', thumbnail_size)
                    .attr('height', thumbnail_size);

                  d3.select(this).append('image')
                    .attr('x', selected_node_bbox.width/2)
                    .attr('y', node_height - 3)
                    .attr('id', 'screenshot_thumbnail')
                    .attr("width", thumbnail_size)
                    .attr("height", thumbnail_size)
                    .attr("xlink:href",`data:image/png;base64,${screenshot_thumbnail}`)
                    .attr('cursor', 'pointer')
                    .on('mouseover', (event, d) => {
                        d3.select('#tooltip')
                          .data(d)
                          .style('opacity', 1)
                          .style('left', `${tipX(event) + 10}px`)
                          .style('top', `${tipY(event) + 10}px`)
                          .text(d => d.data.downloaded_filename ? 'Contains the URL rendered in the browser. It also downloaded a file.': 'Contains the URL rendered in the browser.');
                    })
                    .on('click', (event, d) => {
                        new bootstrap.Modal('#screenshotModal')
                            .show(document.getElementById('screenshotModal'));
                    })
                    .on('mouseout', (event, d) => {
                        d3.select('#tooltip').style('opacity', 0)
                    });
                };

                const http_icon_size = 24;
                if (d.data.http_content) {
                    // set lock insecure connection
                    d3.select(this).append("svg").append('rect')
                        .attr('x', selected_node_bbox.width - 40)
                        .attr('y', selected_node_bbox.height - http_icon_size - 6)
                        .attr('class', 'node-badge')
                        .attr('rx', 4)
                        .attr('width', http_icon_size)
                        .attr('height', http_icon_size);

                    d3.select(this).append('image')
                        .attr('x', selected_node_bbox.width - 40)
                        .attr('y', selected_node_bbox.height - http_icon_size - 6)
                        .attr('id', 'insecure_image')
                        .attr('cursor', 'pointer')
                        .on('click', () => toggleLegendFilter('http_content'))
                        .attr("width", http_icon_size)
                        .attr("height", http_icon_size)
                        .attr("xlink:href", '/static/images/icons/insecure.svg')
                        .on('mouseover', (event, d) => {
                            d3.select('#tooltip')
                                .style('opacity', 1)
                                .style('left', `${tipX(event) + 10}px`)
                                .style('top', `${tipY(event) + 10}px`)
                                .text('This node containts insecure requests');
                        })
                        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
                };
                const context_icon_size = 24;
                if (d.data.malicious) {
                    // set bomb
                    d3.select(this).append("svg").append('rect')
                        .attr('x', selected_node_bbox.width - 40 - http_icon_size - 4)
                        .attr('y', selected_node_bbox.height - http_icon_size - 6)
                        .attr('class', 'node-badge')
                        .attr('rx', 4)
                        .attr('width', context_icon_size)
                        .attr('height', context_icon_size);

                    d3.select(this).append('image')
                        .attr('x', selected_node_bbox.width - 40 - http_icon_size - 4)
                        .attr('y', selected_node_bbox.height - http_icon_size - 6)
                        .attr('id', 'malicious_image')
                        .attr('cursor', 'pointer')
                        .on('click', () => toggleLegendFilter('malicious'))
                        .attr("width", context_icon_size)
                        .attr("height", context_icon_size)
                        .attr("xlink:href", '/static/images/icons/bomb.svg')
                        .on('mouseover', (event, d) => {
                            d3.select('#tooltip')
                                .style('opacity', 1)
                                .style('left', `${tipX(event) + 10}px`)
                                .style('top', `${tipY(event) + 10}px`)
                                .text('This node containts known malicious content');
                        })
                        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
                } else if (d.data.legitimate) {
                    // set checkmark
                    d3.select(this).append("svg").append('rect')
                        .attr('x', selected_node_bbox.width - 40 - http_icon_size - 4)
                        .attr('y', selected_node_bbox.height - http_icon_size - 6)
                        .attr('class', 'node-badge')
                        .attr('rx', 4)
                        .attr('width', context_icon_size)
                        .attr('height', context_icon_size);

                    d3.select(this).append('image')
                        .attr('x', selected_node_bbox.width - 40 - http_icon_size - 4)
                        .attr('y', selected_node_bbox.height - http_icon_size - 6)
                        .attr('id', 'known_image')
                        .attr('cursor', 'pointer')
                        .on('click', () => toggleLegendFilter('legitimate'))
                        .attr("width", context_icon_size)
                        .attr("height", context_icon_size)
                        .attr("xlink:href", '/static/images/icons/check.svg')
                        .on('mouseover', (event, d) => {
                            d3.select('#tooltip')
                                .style('opacity', 1)
                                .style('left', `${tipX(event) + 10}px`)
                                .style('top', `${tipY(event) + 10}px`)
                                .text('This node has only known content');
                        })
                        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
              } else if (d.data.all_empty && !d.data.contains_rendered_urlnode) {
                // set empty
                d3.select(this).append("svg").append('rect')
                    .attr('x', selected_node_bbox.width - 40 - http_icon_size - 4)
                    .attr('y', selected_node_bbox.height - http_icon_size - 6)
                    .attr('class', 'node-badge')
                    .attr('rx', 4)
                    .attr('width', context_icon_size)
                    .attr('height', context_icon_size);

                d3.select(this).append('image')
                    .attr('x', selected_node_bbox.width - 40 - http_icon_size - 4)
                    .attr('y', selected_node_bbox.height - http_icon_size - 6)
                    .attr('id', 'empty_image')
                        .attr('cursor', 'pointer')
                        .on('click', () => toggleLegendFilter('empty'))
                    .attr("width", context_icon_size)
                    .attr("height", context_icon_size)
                    .attr("xlink:href", '/static/images/icons/empty.svg')
                    .on('mouseover', (event, d) => {
                        d3.select('#tooltip')
                            .style('opacity', 1)
                            .style('left', `${tipX(event) + 10}px`)
                            .style('top', `${tipY(event) + 10}px`)
                            .text('This node has only empty content');
                    })
                    .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
              };
              if (d.children || d._children) {
                d3.select(this)
                  // Add Circle for the nodes
                  .append('circle')
                  .attr('class', 'node')
                  .attr('r', 1e-6)
                  .attr('cx', d => d.node_width)
                  .attr('cy', d => node_height/2)
                  .classed('is-collapsed', d => !!d._children)
                  .on('mouseover', (event, d) => {
                      if (d.children || d._children) {
                        d3.select('#tooltip')
                          .style('opacity', 1)
                          .style('left', `${tipX(event) + 10}px`)
                          .style('top', `${tipY(event) + 10}px`)
                          .text(d.children ? 'Collapse the URLs loaded by this node.' : 'Expand the URLs loaded by this node.');
                      };
                    }
                  )
                  .on('mouseout', (event, d) => {
                      if (d.children || d._children) {
                        d3.select('#tooltip').style('opacity', 0)
                      };
                    }
                  )
                  .on('click', (event, d) => {
                      if (d.children || d._children) {
                        toggle_children_collapse(event, d)
                      };
                    }
                  );
              };
            });

            return node_group;
        },
        update => update,
        exit => exit
            .transition()
              // Remove any exiting nodes
              .attr("transform", node => nodeTransform(node, true))
              // On exit reduce the node circles size to 0
              .attr('r', 1e-6)
              // On exit reduce the opacity of text labels
              .style('fill-opacity', 1e-6)
              .remove()
    ).call(node => {
      // After the entry animation, expanding / collapsing moves the nodes smoothly
      (tree_entry_done && !reduce_motion ? node.transition().duration(300).ease(d3.easeCubicOut) : node)
        .attr("transform", node => nodeTransform(node));
      placeNodeParts(node);
      node
        // Update the node attributes and style
        .select('circle.node')
          .attr('r', 9)
          .classed('is-collapsed', node => !!node._children)
          .attr('cursor', (d) => {
            if (d.children || d._children) {
              return 'pointer';
            }
          });

    });

  nodes.forEach(d => {
    // Store the old positions for transition.
    d.x0 = d.x;
    d.y0 = d.y;
  });

  // ****************** links section ***************************

  // Update the links...
  const link = node_container.selectAll('path.link').data(links, d => d.data.uuid);

  // Creates a curved (diagonal) path from parent to the child nodes:
  // horizontal: right side of the parent -> left side of the child,
  // vertical: bottom of the parent -> top of the child (cards are drawn from y = -30)
  let diagonal = orientation === 'horizontal'
      ? d3.linkHorizontal()
          .source(d => [d.y, d.x])
          .target(d => [d.parent.y + d.parent.node_width, d.parent.x])
      : d3.linkVertical()
          .source(d => [d.x + (d.node_width || 0) / 2, d.y - 30])
          .target(d => [d.parent.x + (d.parent.node_width || 0) / 2, d.parent.y + 35 + 9]);

  link.join(
    enter => enter
        // Enter any new links at the parent's previous position.
        .insert('path', "g")
        .attr("class", "link")
        .attr('d', diagonal),
    update => update,
    exit => exit.call(exit => exit.attr('d', diagonal).remove())
  ).call(link => (tree_entry_done && !reduce_motion ? link.transition().duration(300).ease(d3.easeCubicOut) : link)
                    .attr('d', diagonal));

  if (computed_node_width === 0) {
    update(root, node_width)
  }
  // Main path to the rendered page (nodes and links of this update included)
  markPaths();
  // Nodes shown again after an expand keep the filters
  if (active_filters.size > 0 || search_text || focus_uuid || compare_only_new) applyTreeFilter();
}
