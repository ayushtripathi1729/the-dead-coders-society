const bcrypt = require("bcryptjs");

const password = "hacking is not easy";
const hash = "$2b$10$ESZ8DpIVHEpx5fjFjP9yOeQF.ZwULei/oyxHq/l0oMJ5MEA9kqqlO";

bcrypt.compare(password, hash).then(console.log);