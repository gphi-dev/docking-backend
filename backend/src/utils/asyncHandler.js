export function asyncHandler(requestHandler) {
  return function asyncRequestHandler(req, res, next) {
    return Promise.resolve(requestHandler(req, res, next)).catch(next);
  };
}
