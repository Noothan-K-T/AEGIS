import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: "flex" }}>
      <Sidebar collapsed={collapsed} />

      <div style={{ flex: 1 }}>
        <Navbar
          collapsed={collapsed}
          toggleSidebar={() => setCollapsed(!collapsed)}
        />

        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;