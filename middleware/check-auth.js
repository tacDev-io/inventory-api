import jwt from 'jsonwebtoken';

export const checkAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);
    req.userData = {
      email: decodedToken.email,
      userId: decodedToken.userId,
      userRole: decodedToken.userRole
    };
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authenticated! Log in." });
  }
};

