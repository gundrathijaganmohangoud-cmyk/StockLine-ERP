const authService = require('../services/auth.service');

exports.login = async function login(req, res) {
  const result = await authService.login(req.body);
  return res.status(200).json(result);
};

