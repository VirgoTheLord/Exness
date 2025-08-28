"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trade = exports.users = void 0;
exports.users = [
    {
        id: 1,
        name: "Admin User",
        email: "admin@example.com",
        password: "password123",
        balance: { amount: 10000 },
    },
];
var Trade;
(function (Trade) {
    Trade["LONG"] = "long";
    Trade["SHORT"] = "short";
})(Trade || (exports.Trade = Trade = {}));
