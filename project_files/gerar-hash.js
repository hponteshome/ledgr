const bcrypt = require('bcryptjs'); bcrypt.hash('123456', 10).then(h => console.log('HASH GERADO: ' + h));
