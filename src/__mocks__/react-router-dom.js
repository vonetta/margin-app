// react-router-dom v7 is ESM-only; the Jest version bundled with
// react-scripts 5 can't resolve it at all (even just to require it for
// jest.requireActual), so any test that imports a component using it
// needs this manual mock. Override specific exports per-test with
// jest.mock("react-router-dom", () => ({ ...require("../__mocks__/react-router-dom"), useNavigate: ... })).
module.exports = {
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/" }),
  useParams: () => ({}),
  Link: ({ children }) => children,
  MemoryRouter: ({ children }) => children,
};
