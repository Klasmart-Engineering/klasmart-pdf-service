npm install -g gulp
npm link gulp
npm link gulp-less
npm link gulp-watch
npm link gulp-autoprefixer
npm link gulp-plumber
npm link path
git clone https://github.com/mozilla/pdf.js.git temp-pdf.js
git --git-dir=./temp-pdf.js/.git checkout 07955fa1d31df62fd668a15f58cd40b29a82bd63
npm --prefix ./temp-pdf.js/ install ./temp-pdf.js/
gulp --cwd=./temp-pdf.js/ dist-install
cp -r ./temp-pdf.js/build/dist ./node_modules/pdfjs-dist
rm -rf ./temp-pdf.js
