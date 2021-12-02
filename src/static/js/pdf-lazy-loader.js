/* 
    Initialize
*/
function initialize() {
    // Intersection duration before loading image in ms
    const pageloadDelay = 500;
    const viewportMargin = '5000px 0px 5000px 0px';
    const pages = document.querySelectorAll('.pdf-page-img');
    const pageCount = pages.length;
    const timings = [...new Array(pageCount)].map(_ => 0);
    const state = [...new Array(pageCount)].map(_ => false);
    const loaded = [...new Array(pageCount)].map(_ => false);
    loaded[0] = true;


    /* 
        Handler for intersection observation
    */
    function handleIntersection(entries) {
        entries.forEach(entry => {
            const { target } = entry;
            const index = +target.dataset.pageNum - 1;

            if (entry.isIntersecting) {
                state[index] = true;
                timings[index] = entry.time;
            } else {
                state[index] = false;
                timings[index] = 0;
            }
        })
    }

    const intersectionObserver = new IntersectionObserver(handleIntersection, {
        rootMargin: viewportMargin,
        threshold: 0.5
    });

    pages.forEach(page => {
        intersectionObserver.observe(page);
    });

    /*
        Interval used to check intersection state, could probably be optimized a bit
    */
    setInterval(() => {
        const time = performance.now();
        for(let x = 0; x < pageCount; x++) {
            if (!state[x] || loaded[x]) continue;
            if (timings[x] + 100 < time) {
                pages[x].src = pages[x].dataset.src;
                loaded[x] = true;
            } 
        }
    }, pageloadDelay);
}

setTimeout(() => initialize(), 100);
