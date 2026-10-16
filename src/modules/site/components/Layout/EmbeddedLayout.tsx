import { Outlet } from "react-router-dom";

export function EmbeddedLayout() {
  return (
    <div className="site-root site-root--embedded">
      <Outlet />
    </div>
  );
}
