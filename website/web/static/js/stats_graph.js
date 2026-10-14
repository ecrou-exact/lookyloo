"use strict";
// Admin statistics (admin/stats.html): one bar chart per year, captures per month.
// The data is in the page (data-months / data-month-numbers of .lk-stats-chart);
// the colours come from css/stats.css (tokens). Doc: doc/ui/pages/stats.md
(() => {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const margin = { top: 20, right: 16, bottom: 28, left: 40 };
    const height = 220;
    const reduce_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // animate: bars growing from the axis (on arrival on the page, not on a resize)
    function draw(container, animate=false) {
        const counts = JSON.parse(container.dataset.months || '[]');
        const numbers = JSON.parse(container.dataset.monthNumbers || '[]');
        const by_month = new Map(numbers.map((m, i) => [m, counts[i]]));
        const data = MONTHS.map((name, i) => ({ name, value: by_month.get(i + 1) || 0 }));

        container.textContent = '';
        const width = Math.max(container.clientWidth, 320);
        const svg = d3.select(container).append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
        const x = d3.scaleBand().domain(MONTHS).range([margin.left, width - margin.right]).padding(0.25);
        const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(data, d => d.value))]).nice()
            .range([height - margin.bottom, margin.top]);

        svg.append('g').attr('class', 'lk-stats-grid')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(4).tickSize(-(width - margin.left - margin.right)).tickFormat(d3.format('~s')))
            .call(g => g.select('.domain').remove());
        svg.append('g').attr('class', 'lk-stats-axis')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).tickSizeOuter(0));

        const bars = svg.append('g').selectAll('g').data(data).join('g');
        const rects = bars.append('rect')
            .attr('class', d => d.value ? 'lk-stats-bar' : 'lk-stats-bar is-empty')
            .attr('x', d => x(d.name)).attr('width', x.bandwidth())
            .attr('rx', 4);
        rects.append('title').text(d => `${d.name}: ${d.value} capture${d.value === 1 ? '' : 's'}`);
        const labels = bars.filter(d => d.value > 0).append('text')
            .attr('class', 'lk-stats-bar-label')
            .attr('x', d => x(d.name) + x.bandwidth() / 2).attr('y', d => y(d.value) - 6)
            .attr('text-anchor', 'middle').text(d => d3.format(',')(d.value));
        if (animate && !reduce_motion) {
            rects.attr('y', y(0)).attr('height', 0)
                .transition().delay((_, i) => i * 45).duration(700).ease(d3.easeCubicOut)
                .attr('y', d => y(d.value)).attr('height', d => y(0) - y(d.value));
            labels.style('opacity', 0)
                .transition().delay((_, i) => 400 + i * 45).duration(400).style('opacity', 1);
        } else {
            rects.attr('y', d => y(d.value)).attr('height', d => y(0) - y(d.value));
        }
    }

    // The numbers of the cards count up to their value
    function countUp(element) {
        const target = parseInt(element.dataset.value, 10);
        if (!Number.isFinite(target) || reduce_motion) return;
        const format = d3.format(',');
        d3.select(element).transition().duration(900).ease(d3.easeCubicOut)
            .tween('text', () => {
                const value = d3.interpolateRound(0, target);
                return t => { element.textContent = format(value(t)); };
            });
    }

    const charts = document.querySelectorAll('.lk-stats-chart');
    charts.forEach(chart => draw(chart, true));
    document.querySelectorAll('.lk-stats-card-value[data-value]').forEach(countUp);
    let timer = null;
    window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(() => charts.forEach(draw), 150);
    });
})();
