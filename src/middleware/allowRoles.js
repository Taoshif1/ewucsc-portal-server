export const allowRoles = (...roles) => {
  return (req, res, next) => {
    const role = req.memberUser?.role || req.adminUser?.role || req.user?.role;

    if (!roles.includes(role)) {
      return res.status(403).send({ message: "You do not have permission for this action" });
    }

    return next();
  };
};
