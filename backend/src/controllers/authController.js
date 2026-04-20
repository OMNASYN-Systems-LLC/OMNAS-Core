import { loginUser, registerUser } from "../services/authService.js";

export async function registerController(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email and password are required"
      });
    }

    const user = await registerUser({ name, email, password });

    return res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    return next(error);
  }
}

export async function loginController(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required"
      });
    }

    const session = await loginUser({ email, password });

    return res.json({
      success: true,
      data: session
    });
  } catch (error) {
    return next(error);
  }
}
