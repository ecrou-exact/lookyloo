"use strict";
function mispSelector() {
  let mispSelectorButtons = document.querySelectorAll('#mispSelector button');
  mispSelectorButtons.forEach((b) => {
    b.addEventListener('click', (e) => {
      e.currentTarget.parentNode.childNodes.forEach((s) => {
        if (s.nodeType !== 3) {
            // not text node
            s.classList.remove("active");
        }
      });
      document.getElementById(e.currentTarget.value).parentNode.childNodes.forEach((s) => {
        if (s.nodeType !== 3) {
          // not text node
          s.style.display = 'none';
        }
      });
      e.currentTarget.classList.add('active')
      document.getElementById(e.currentTarget.value).style.display = 'block';
    });
  });
};

//download the tree as png file
// The colours of the tree come from css/tree.css: copy the computed styles in the
// copy, or the exported image would lose them.
const SVG_STYLE_PROPERTIES = ['fill', 'stroke', 'stroke-width', 'stroke-opacity', 'fill-opacity',
                              'opacity', 'font-family', 'font-size', 'font-weight', 'text-decoration'];
function inlineSvgStyles(source, copy) {
    const sources = source.querySelectorAll('*');
    const copies = copy.querySelectorAll('*');
    sources.forEach((element, i) => {
        const computed = getComputedStyle(element);
        copies[i].setAttribute('style', SVG_STYLE_PROPERTIES
            .map(property => `${property}:${computed.getPropertyValue(property)}`).join(';'));
    });
}

const downloadSvg = () => {
    const svg = document.querySelector('#tree_svg > svg');
    const svgCopy = svg.cloneNode(true);
    // The tree only, without the free room around it (js/tree.js, sizeTreeSvg)
    const [page_width, page_height] = (svg.dataset.lkPage || '').split(' ').map(Number);
    if (page_width && page_height) {
        svgCopy.setAttribute('viewBox', `0 0 ${page_width} ${page_height}`);
        svgCopy.setAttribute('width', page_width);
        svgCopy.setAttribute('height', page_height);
    }
    inlineSvgStyles(svg, svgCopy);
    const images = svgCopy.querySelectorAll('image');
    const promises = [];
    images.forEach((imageElement) => {
        const promise = new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const image = new Image();
            image.onload = function() {
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0);
                const dataURL = canvas.toDataURL("image/svg+xml");
                imageElement.setAttribute('href', dataURL);
                resolve();
            };
            image.onerror = function() {
                reject(new Error('Error'));
            };
            image.src = imageElement.getAttribute('href');
        });
        promises.push(promise);
    });

    Promise.all(promises).then(() => {
        let svgData = new XMLSerializer().serializeToString(svgCopy);
        let svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        let url = URL.createObjectURL(svgBlob);
        let img = new Image();
        img.onload = function() {
            let canvas = document.createElement('canvas');
            // Size of the tree on the page (the detached copy can't resolve it)
            canvas.width = parseFloat(svgCopy.getAttribute('width'));
            canvas.height = parseFloat(svgCopy.getAttribute('height'));
            let ctx = canvas.getContext('2d');
            // Background of the tree area (css/tree.css), behind the exported tree
            ctx.fillStyle = getComputedStyle(document.getElementById('tree_viewport')).backgroundColor;
            ctx.fillRect(0,0,canvas.width,canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            let png = canvas.toDataURL('image/png');
            let a = document.createElement('a');
            a.download = 'tree.png';
            a.href = png;
            a.click();
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }).catch((error) => {
        console.error('Error:', error);
    });
};

// Show a node of the tree (the node of the URL in ?node=, or "Locate in tree" from
// the hostname pop-up): it is centred in the tree and its card glows for a few
// seconds (css/tree.css, g.node.is-located); a click anywhere stops it.
function LocateNode(hostnode_uuid) {
    const element = document.getElementById(`node_${hostnode_uuid}`);
    if (!element) {
        return;   // in a collapsed branch: nothing to show
    }
    // Scrolls only the tree viewport (js/tree.js)
    const card = element.querySelector('.node-card') || element;
    window.centerInViewport ? window.centerInViewport(card) : element.scrollIntoView({block: "center", inline: "center"});

    document.querySelectorAll('g.node.is-located').forEach(node => node.classList.remove('is-located'));
    document.querySelectorAll('.node-located-label').forEach(label => label.remove());
    element.classList.add('is-located');

    // A label above the card ("This node"), with a small pointer to it
    const label = d3.select(element).append('g').attr('class', 'node-located-label');
    const text = label.append('text').attr('x', 10).attr('y', -46).text('This node');
    const width = text.node().getBBox().width + 20;
    label.insert('rect', 'text').attr('x', 0).attr('y', -62).attr('rx', 6).attr('width', width).attr('height', 22);
    label.insert('path', 'text').attr('d', 'M14,-40.5 l6,7 l6,-7 Z');

    clearTimeout(LocateNode.timer);
    const stop = () => {
        element.classList.remove('is-located');
        label.remove();
        document.removeEventListener('pointerdown', stop, true);
    };
    LocateNode.timer = setTimeout(stop, 8000);
    // After this click (the one of "Locate in tree" may still be going on)
    setTimeout(() => document.addEventListener('pointerdown', stop, true), 0);
};

// Modals
document.addEventListener("DOMContentLoaded", () => {
    // Every modal loaded from the server (macros/modals.html remote_modal): the link
    // that opens it carries the URL of the content in data-remote.
    document.querySelectorAll('.modal[data-lk-remote-modal]').forEach(modal => {
        modal.addEventListener('show.bs.modal', function(e) {
          const curTarget = e.currentTarget;
          const remote = e.relatedTarget?.dataset.remote;
          if (!remote) {
            // Opened without a link (e.g. from code): keep the current content
            return;
          }
          // Eyes while loading, also when the modal is opened again with other content
          curTarget.querySelector('.modal-body').innerHTML = lkLoader('Loading', 'md', true);
          const body = curTarget.querySelector('.modal-body');
          fetch(remote)
            .then(response => {
                // A redirect is an error page of the site (e.g. a capture removed in the
                // meantime): say it, rather than showing another page in the panel
                if (!response.ok || response.redirected) throw new Error(response.status);
                return response.text();
            })
            .then(data => {
                body.innerHTML = data;
                renderTables();
                submitPandoraListener();
                mispSelector();
                document.getElementById("dlTreeAsSVG")?.addEventListener("click", downloadSvg);
            })
            .catch(() => {
                const message = document.createElement('div');
                message.className = 'alert alert-warning';
                message.setAttribute('role', 'alert');
                message.textContent = 'Unable to load this panel: the capture may have been removed, or is still being processed. Reload the page.';
                body.replaceChildren(message);
            })
        });
    });

    // OnClicks
    document.getElementById("removeCapture")?.addEventListener("click", function (e) {
      e.preventDefault();
      if (confirm('Are you sure you want to remove the capture?')) {
        window.location = this.href;
      };
    }, false);

    // A checkbox that enables a button (data-lk-enables="<id>"), e.g. "push anyway" in
    // the MISP push panel: in the loaded fragments, no inline handler (CSP)
    document.addEventListener('change', (event) => {
        const target = event.target.dataset?.lkEnables;
        if (target) document.getElementById(target)?.toggleAttribute('disabled', !event.target.checked);
    });

    // Actions > Download > Tree as PNG
    document.getElementById("tree-download-png")?.addEventListener("click", downloadSvg);

    document.getElementById("unbookmarkAllNodes")?.addEventListener("click", UnbookmarkAllNodes);

    document.getElementById("markAsKnown")?.addEventListener("click", function (e) {
      MarkAsKnown(treeUUID)
    });

    // Blur / Unblur the screenshot (blurred at first, tree/tree.html)
    const BLUR_ICONS = { blurred: 'bi:eye', clear: 'bi:eye-slash' };   // tools/build_icons.py reads them here
    document.getElementById("blurScreenshot")?.addEventListener("click", function () {
      const blurred = document.getElementById('screenshot').classList.toggle('blur');
      const sprite = this.querySelector('use')?.getAttribute('href')?.split('#')[0];
      this.setAttribute('aria-pressed', blurred ? 'true' : 'false');
      this.textContent = '';
      if (sprite) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'lk-icon');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `${sprite}#${(blurred ? BLUR_ICONS.blurred : BLUR_ICONS.clear).replace(':', '-')}`);
        svg.appendChild(use);
        this.appendChild(svg);
      }
      this.append(blurred ? ' Unblur' : ' Blur');
    });
});
