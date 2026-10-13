"use strict";
// From : https://bl.ocks.org/d3noob/43a860bc0024792f8803bba8ca0d5ecd

// Set the dimensions and margins of the diagram.
// The tree is drawn in a scrolling viewport under the capture bar (tree/tree.html),
// so it only needs room for the parent-capture box above the root.
let margin = {
    top: 40,
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
  update(root);
  setupLegendFilter(root);
  setupTreeSearch();
  // Scroll once the nodes are in place
  await animateTreeEntry(root);

  if (document.getElementById('tree_js').dataset.urlnode != null){
    history.scrollRestoration = "manual";
    LocateNode(document.getElementById('tree_js').dataset.urlnode);
  }
  else {
    let rendered_node = document.getElementById('screenshot_thumbnail');
    rendered_node.scrollIntoView({behavior: "smooth", block: "end", inline: "center"});
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
        .attr('transform', `translate(${root.y}, ${root.x})`);
    links.interrupt().attr('opacity', 0);
    const moved = nodes.transition('entry')
        .delay(d => d.depth * ENTRY_STEP_MS)
        .duration(ENTRY_MOVE_MS)
        .ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .attr('transform', d => `translate(${d.y}, ${d.x})`)
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
    return icon_ok && text_ok && focus_ok;
}

function matchingNodes() {
    return node_container.selectAll('g.node').filter(d => nodeMatches(d)).nodes();
}

function applyTreeFilter() {
    const filtering = active_filters.size > 0 || search_text !== '' || focus_uuid !== null;
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
    node.scrollIntoView({behavior: reduce_motion ? 'auto' : 'smooth', block: 'center', inline: 'center'});
    node_container.selectAll('g.node').classed('is-search-current', false);
    d3.select(node).classed('is-search-current', true);
    const count = document.getElementById('tree-search-count');
    if (count && nodes.length > 1) count.textContent = `${search_index + 1} / ${nodes.length}`;
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
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY + 10}px`)
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
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY + 10}px`)
                .text('Bookmark this node');
        })
        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
};

function NodeHighlight(hostnode_uuid) {
    let element = document.getElementById(`node_${hostnode_uuid}`);
    element.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});

    d3.select(`#node_${hostnode_uuid}`).select('.node_data').classed('is-bookmarked', true);
    d3.select(`#node_${hostnode_uuid}`).select("#bookmark")
        .text('❌')
        .on('click', (event, d) => UnbookmarkHostNode(d.data.uuid))
        .on('mouseover', (event, d) => {
            d3.select('#tooltip')
                .style('opacity', 1)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY + 10}px`)
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
                      .style('left', `${event.pageX + 10}px`)
                      .style('top', `${event.pageY + 10}px`)
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
                  .style('left', `${event.pageX + 10}px`)
                  .style('top', `${event.pageY + 10}px`)
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
                  .style('left', `${event.pageX + 10}px`)
                  .style('top', `${event.pageY + 10}px`)
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
    // Re-compute SVG size depending on the generated tree
    let svgWidth = Math.max((max_depth + 1) * computed_node_width, node_width);
    // Update height
    // node_height is the height of a node, menuHeight * 3 is the minimum so the root node isn't behind the menu
    let svgHeight = Math.max(root.descendants().reverse().length * node_height, min_height);
    tree.size([svgHeight, svgWidth])

    // Set background based on the computed width and height
    let background = main_svg.insert('rect', ':first-child')
      .attr('class', 'tree-background')
      .attr('y', 0)
      // Note: We want the background width with an extra computed_node_width
      // in order to make sure the last node is completely covered
      .attr('width', svgWidth + (margin.right + margin.left + computed_node_width))
      .attr('height', svgHeight + margin.top + margin.bottom)
      .style('fill', "url(#backstripes)");

    // Update size
    main_svg
      .attr("width", svgWidth + (margin.right + margin.left)*2)
      .attr("height", svgHeight + margin.top + margin.bottom)

    // Update pattern
    main_svg.selectAll('pattern')
      .attr('width', `${computed_node_width * 2}px`)
    pattern.selectAll('rect')
      .attr('width', `${computed_node_width}px`)

    let tree_bbox = main_svg.node().getBBox()
    document.getElementById('tree_svg').style.width = Math.max(tree_bbox.width, min_width);
    document.getElementById('tree_svg').style.height = Math.max(tree_bbox.height, min_height);
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
                .attr('class', 'node')
                .attr("id", d => `node_${d.data.uuid}`)
                .attr("transform", `translate(${root.y0}, ${root.x0})`);

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
                                .style('left', `${event.pageX + 10}px`)
                                .style('top', `${event.pageY + 10}px`)
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
                                .style('left', `${event.pageX + 10}px`)
                                .style('top', `${event.pageY + 10}px`)
                                .text('Bookmark this node');
                        })
                        .on('mouseout', (event, d) => d3.select('#tooltip').style('opacity', 0));
                };

                const thumbnail_size = 64;
                if (d.data.contains_rendered_urlnode) {
                  center_node = d.data.uuid;
                  if (favicon) {
                    // Chip behind the favicon: a dark favicon stays visible in dark mode
                    d3.select(this).append('rect')
                      .attr('class', 'node-icon-chip')
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
                            .style('left', `${event.pageX + 10}px`)
                            .style('top', `${event.pageY + 10}px`)
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
                          .style('left', `${event.pageX + 10}px`)
                          .style('top', `${event.pageY + 10}px`)
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
                                .style('left', `${event.pageX + 10}px`)
                                .style('top', `${event.pageY + 10}px`)
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
                                .style('left', `${event.pageX + 10}px`)
                                .style('top', `${event.pageY + 10}px`)
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
                                .style('left', `${event.pageX + 10}px`)
                                .style('top', `${event.pageY + 10}px`)
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
                            .style('left', `${event.pageX + 10}px`)
                            .style('top', `${event.pageY + 10}px`)
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
                          .style('left', `${event.pageX + 10}px`)
                          .style('top', `${event.pageY + 10}px`)
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
              .attr("transform", node => `translate(${node.y0}, ${node.x0})`)
              // On exit reduce the node circles size to 0
              .attr('r', 1e-6)
              // On exit reduce the opacity of text labels
              .style('fill-opacity', 1e-6)
              .remove()
    ).call(node => {
      // After the entry animation, expanding / collapsing moves the nodes smoothly
      (tree_entry_done && !reduce_motion ? node.transition().duration(300).ease(d3.easeCubicOut) : node)
        .attr("transform", node => `translate(${node.y}, ${node.x})`);
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
  const link = node_container.selectAll('path.link').data(links, d => d.id);

  // Creates a curved (diagonal) path from parent to the child nodes
  let diagonal = d3.linkHorizontal()
                        .source(d => {return [d.y, d.x]})
                        .target(d => {return [d.parent.y + d.parent.node_width, d.parent.x]});

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
  // Nodes shown again after an expand keep the filters
  if (active_filters.size > 0 || search_text || focus_uuid) applyTreeFilter();
}
