import { createDocumentFromStream, generatePageImage } from './image-converter';

const processPDF = async () => {
    try {
        const document = await createDocumentFromStream('./test.pdf');
        const pages = Array.from(Array(document.numPages).keys()).map(x => x+1);
        console.log(`Pages: ${pages}`)
        const promises = pages.map(p => generatePageImage(document, p));
        await Promise.all(promises);
        console.log('All done!');
    } catch (err) {
        console.error(err);
    }
};

processPDF();