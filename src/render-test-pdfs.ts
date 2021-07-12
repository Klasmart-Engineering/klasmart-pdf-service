// import fs from 'fs';
// import { withLogger } from './logger';
// import * as pdfService from './pdf-service';
// import { createDocumentFromStream } from './image-converter';
// import * as pdf from 'pdfjs-dist';

// const log = withLogger('render-test-pdfs');

// interface Manifest {
//     pdfs: {
//         file: string,
//         valid: boolean,
//         description: string
//     }[];
// }

// async function renderTestPdfs() {
//     const manifestData: Manifest = JSON.parse(fs.readFileSync(__dirname + '/testing-pdfs/manifest.json').toString());
    
//     for(const pdfMetadata of manifestData.pdfs) {
//         log.info(`Testing validity of pdf: ${pdfMetadata.file}.`)
//         log.info(`Expectation: ${pdfMetadata.valid}`)
        
//         const readStream = fs.createReadStream(`${__dirname}/testing-pdfs/assets/${pdfMetadata.file}`);
//         const document = pdf.getDocument({
//             data: readStream
//         });
//     }

// }


// renderTestPdfs();
