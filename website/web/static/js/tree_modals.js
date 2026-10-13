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
            canvas.width = parseFloat(svg.getAttribute('width'));
            canvas.height = parseFloat(svg.getAttribute('height'));
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

function LocateNode(hostnode_uuid) {
    let element = document.getElementById(`node_${hostnode_uuid}`);
    // Scrolls only the tree viewport (js/tree.js)
    window.centerInViewport ? window.centerInViewport(element) : element.scrollIntoView({block: "center", inline: "center"});

    let line_arrow = d3.select(`#node_${hostnode_uuid}`)
                       .append('g')
                        .attr('cursor', 'pointer')
                        .on('click', (event, d) => { event.currentTarget.remove(); });

    let line = d3.line()
                    // Other options: http://bl.ocks.org/d3indepth/raw/b6d4845973089bc1012dec1674d3aff8/
                    //.curve(d3.curveCardinal)
                    .curve(d3.curveBundle)
                    .x(point => point.lx)
                    .y(point => point.ly);

    let line_tip = d3.symbol()
                    .type(d3.symbolTriangle)
                    .size(200);


    // Theme colours (css/theme.css): the arrow glows from ink to danger
    const theme = getComputedStyle(document.documentElement);
    const ink = theme.getPropertyValue('--lk-color-ink').trim();
    const danger = theme.getPropertyValue('--lk-color-danger').trim();
    const surface = theme.getPropertyValue('--lk-color-surface').trim();

    let path = line_arrow
        .append("path")
        .attr("stroke-width", "3")
        .attr("stroke", ink)
        .attr("fill", "none")
        .data([{
            source: {x: 100, y: -100},
            target: {x: 50, y: -50}
        }])
        .attr("class", "line")
        .attr("d", d => line(
            [{lx: d.source.x, ly: d.source.y},
             {lx: d.target.x, ly: d.source.y},
             {lx: d.target.x, ly: d.target.y}
            ])
        );

    let arrow = line_arrow
        .append("path")
        .attr("d", line_tip)
        .attr("stroke", ink)
        .style('stroke-width', '3')
        .attr("fill", surface)
        .attr("transform", `translate(50, -50) rotate(60)`);

    let glow = () => {
        line_arrow.selectAll('path')
            .transition().duration(1000)  //Set transition
            .style('stroke-width', '7')
            .style('stroke', danger)
            .transition().duration(1000)  //Set transition
            .style('stroke-width', '3')
            .style('stroke', ink)
            .on("end", () => {
                if (++i > 15) {
                    line_arrow.remove();
                } else {
                    glow();
                }
            });
    };

    let i = 0;
    glow();
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
          fetch(remote)
            .then(response => response.text())
            .then(data => {
                curTarget.querySelector('.modal-body').innerHTML = data;
                renderTables();
                submitPandoraListener();
                mispSelector();
                document.getElementById("dlTreeAsSVG")?.addEventListener("click", downloadSvg);
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

    document.getElementById("unbookmarkAllNodes")?.addEventListener("click", UnbookmarkAllNodes);

    document.getElementById("markAsKnown")?.addEventListener("click", function (e) {
      MarkAsKnown(treeUUID)
    });

    document.getElementById("blurScreenshot")?.addEventListener("click", function (e) {
      let blur_status = document.getElementById('screenshot').classList.toggle('blur');
      if (blur_status) {
        this.innerText = 'Unblur';
      } else {
        this.innerText = 'Blur';
      }
    });
});
