const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

function renderWithLayout(res, view, data = {}, layout = 'main') {
  const viewPath = path.join(__dirname, '../views', view + '.ejs');
  const layoutPath = path.join(__dirname, '../views/layouts', layout + '.ejs');

  ejs.renderFile(viewPath, { ...res.locals, ...data }, {}, (err, bodyHtml) => {
    if (err) {
      console.error('View render error:', err);
      return res.status(500).send('Erreur de rendu');
    }
    ejs.renderFile(layoutPath, { ...res.locals, ...data, body: bodyHtml }, {}, (err2, html) => {
      if (err2) {
        console.error('Layout render error:', err2);
        return res.status(500).send('Erreur de layout');
      }
      res.send(html);
    });
  });
}

module.exports = { renderWithLayout };
