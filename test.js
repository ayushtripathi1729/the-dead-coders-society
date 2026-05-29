const bcrypt = require("bcryptjs");

const password = "test";
const hash = "test";

bcrypt.compare(password, hash).then(console.log);