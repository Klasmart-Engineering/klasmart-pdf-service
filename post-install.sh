git clone https://github.com/mozilla/pdf.js.git temp-pdf.js
git --git-dir=./temp-pdf.js/.git checkout 705d1cfad3b7d79b5cb2a35501b9fdff7db50b86
npm --prefix ./temp-pdf.js/ install ./temp-pdf.js/
gulp --cwd=./temp-pdf.js/ dist-install
cp -r ./temp-pdf.js/build/dist ./node_modules/pdfjs-dist
rm -rf ./temp-pdf.js
