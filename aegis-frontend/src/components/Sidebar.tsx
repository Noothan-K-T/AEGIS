import { NavLink } from "react-router-dom";
import { useAlert } from "../context/AlertContext";
import "./Sidebar.css";

const Sidebar = () => {

  const { newAlert } = useAlert();

  return (
    <div className="sidebar">

      <NavLink to="/" className="nav-link">Dashboard</NavLink>
      <NavLink to="/cases" className="nav-link">Cases</NavLink>
      <NavLink to="/alerts" className="nav-link alert-link">
        Alerts
        {newAlert && <span className="alert-dot"></span>}
      </NavLink>

      <NavLink to="/analytics" className="nav-link">Analytics</NavLink>

      <NavLink to="/livemap" className="nav-link">Surveillance Map</NavLink>
      <NavLink to="/settings" className="nav-link">Settings</NavLink>

    </div>
  );
};

export default Sidebar;