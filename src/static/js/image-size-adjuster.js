function adjustImageSize() {
    const firstPage = document.querySelector('#pdf-page-1');
    const allPages = document.querySelectorAll('.pdf-page-img');
    
    /* Assigns a min height equivalent to the first page's height when it loads to all
        unloaded pages 
    */
    firstPage.addEventListener('load', () => {
        const defaultHeight = firstPage.clientHeight;
        allPages.forEach(p => {
            if (p.clientHeight === 500) {
                p.style.minHeight = `${defaultHeight}px`;
            }
        });
    });
    
    /*
        Removes default height on page load
        in the odd case that a PDF has an inconsistent page size
    */
    for(let i = 1; i < allPages.length; i++) {
        const p = allPages[i];
        p.addEventListener('load', () => {
            p.style.minHeight = '';
        })
    }
}

adjustImageSize();