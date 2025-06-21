// services/backblaze.js
const B2 = require('backblaze-b2');

const b2 = new B2({
    applicationKeyId: process.env.B2_ACCOUNT_ID,
    applicationKey: process.env.B2_APP_KEY,
});

async function authorizeB2() {
    await b2.authorize();
}

module.exports = {
    b2,
    authorizeB2,
};
