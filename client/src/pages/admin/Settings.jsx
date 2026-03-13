import React, { useEffect, useState } from "react";
import axios from "axios";
import DeleteConfirmModal from "../../components/DeleteConfirmModal";
import { toast } from "react-toastify";

const api = {
  getRoles: async () => (await axios.get(`/api/rbac/roles`)).data,
  createRole: async (data) => (await axios.post(`/api/rbac/roles`, data)).data,
  updateRole: async (id, data) =>
    (await axios.put(`/api/rbac/roles/${id}`, data)).data,
  deleteRole: async (id) => (await axios.delete(`/api/rbac/roles/${id}`)).data,
  getMenus: async () => (await axios.get(`/api/rbac/menus`)).data,
  createMenu: async (data) => (await axios.post(`/api/rbac/menus`, data)).data,
  updateMenu: async (id, data) =>
    (await axios.put(`/api/rbac/menus/${id}`, data)).data,
  deleteMenu: async (id) => (await axios.delete(`/api/rbac/menus/${id}`)).data,
  getRoleAccess: async (roleId) =>
    (await axios.get(`/api/rbac/role-access/${roleId}`)).data,
  updateRoleAccess: async (roleId, menuIds) =>
    (await axios.put(`/api/rbac/role-access/${roleId}`, { menuIds })).data,
  getUsers: async () => (await axios.get(`/api/rbac/users`)).data,
  getUserAccess: async (userId) =>
    (await axios.get(`/api/rbac/user-access/${userId}`)).data,
  updateUserAccess: async (userId, menuIds) =>
    (await axios.put(`/api/rbac/user-access/${userId}`, { menuIds })).data,
};

function RoleManager() {
  const [roles, setRoles] = useState([]);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setRoles(await api.getRoles());
      } catch (err) {
        toast.error(err?.response?.data?.message || "Failed to fetch roles");
      }
    };
    fetchRoles();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setName("");
    setDescription("");
    setStatus("active");
  };

  const handleSubmit = async () => {
    if (!name) return toast.warning("Role name required");
    setLoading(true);
    const payload = { name, description, status };

    try {
      if (editId) {
        const res = await api.updateRole(editId, payload);
        const updatedRole = res.role || res;
        setRoles((prev) =>
          prev.map((r) =>
            r._id === editId ? { ...r, ...payload, ...updatedRole } : r
          )
        );
        toast.success("Role updated successfully!");
      } else {
        const res = await api.createRole(payload);
        const newRole = res.role || res;
        setRoles((prev) => [{ ...payload, ...newRole }, ...prev]);
        toast.success("Role created successfully!");
      }
      resetForm();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save role");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (role) => {
    setEditId(role._id);
    setName(role.name);
    setDescription(role.description || "");
    setStatus(role.status);
  };

  const handleDelete = (id) => {
    setDeleteRoleId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await api.deleteRole(deleteRoleId);
      setRoles((prev) => prev.filter((r) => r._id !== deleteRoleId));
      toast.success("Role deleted successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete role");
    } finally {
      setShowDeleteModal(false);
      setDeleteRoleId(null);
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-body">
        <DeleteConfirmModal
          show={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
          message="Are you sure you want to delete this role?"
        />
        <h5 className="card-title">Roles</h5>
        <div className="row mb-3 g-2">
          <div className="col-lg-4">
            <input
              className="form-control"
              placeholder="Role Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="col-lg-4">
            <input
              className="form-control"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="col-lg-2">
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="col-lg-2">
            <button
              className="btn btn-primary w-100"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Saving..." : editId ? "Update" : "Add"}
            </button>
          </div>
          {editId && (
            <div className="col-lg-12">
              <button className="btn btn-secondary btn-sm" onClick={resetForm}>
                Cancel Edit
              </button>
            </div>
          )}
        </div>
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th width="150">Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r._id}>
                  <td>{r.name}</td>
                  <td>{r.description || "-"}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === "active" ? "bg-success" : "bg-secondary"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => handleEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(r._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-3">
                    No roles found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MenuManager() {
  const [menus, setMenus] = useState([]);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [route, setRoute] = useState("");
  const [icon, setIcon] = useState("");
  const [status, setStatus] = useState("active");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMenuId, setDeleteMenuId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        setMenus(await api.getMenus());
      } catch (err) {
        toast.error(err?.response?.data?.message || "Failed to fetch menus");
      }
    };
    fetchMenus();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setName("");
    setRoute("");
    setIcon("");
    setStatus("active");
  };

  const handleSubmit = async () => {
    if (!name || !route) return toast.warning("Name & Route required");
    setLoading(true);
    const payload = { name, route, icon, status };

    try {
      if (editId) {
        const res = await api.updateMenu(editId, payload);
        const updatedMenu = res.menu || res;
        setMenus((prev) =>
          prev.map((m) =>
            m._id === editId ? { ...m, ...payload, ...updatedMenu } : m
          )
        );
        toast.success("Menu updated successfully!");
      } else {
        const res = await api.createMenu(payload);
        const newMenu = res.menu || res;
        setMenus((prev) => [{ ...payload, ...newMenu }, ...prev]);
        toast.success("Menu created successfully!");
      }
      resetForm();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save menu");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (menu) => {
    setEditId(menu._id);
    setName(menu.name);
    setRoute(menu.route);
    setIcon(menu.icon || "");
    setStatus(menu.status);
  };

  const handleDelete = (id) => {
    setDeleteMenuId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await api.deleteMenu(deleteMenuId);
      setMenus((prev) => prev.filter((m) => m._id !== deleteMenuId));
      toast.success("Menu deleted successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete menu");
    } finally {
      setShowDeleteModal(false);
      setDeleteMenuId(null);
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-body">
        <DeleteConfirmModal
          show={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
          message="Are you sure you want to delete this menu?"
        />
        <h5 className="card-title">Menus</h5>
        <div className="row mb-3 g-2">
          <div className="col-lg-3">
            <input
              className="form-control"
              placeholder="Menu Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="col-lg-3">
            <input
              className="form-control"
              placeholder="Route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            />
          </div>
          <div className="col-lg-2">
            <input
              className="form-control"
              placeholder="Icon (bi-*)"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
          </div>
          <div className="col-lg-2">
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="col-lg-2">
            <button
              className="btn btn-primary w-100"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Saving..." : editId ? "Update" : "Add"}
            </button>
          </div>
          {editId && (
            <div className="col-lg-12">
              <button className="btn btn-secondary btn-sm" onClick={resetForm}>
                Cancel Edit
              </button>
            </div>
          )}
        </div>
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Route</th>
                <th>Icon</th>
                <th>Status</th>
                <th width="150">Action</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m._id}>
                  <td>{m.name}</td>
                  <td>{m.route}</td>
                  <td>
                    <i className={`bi ${m.icon}`}></i> {m.icon || "-"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        m.status === "active" ? "bg-success" : "bg-secondary"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => handleEdit(m)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(m._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {menus.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-3">
                    No menus found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleMenuAccess() {
  const [roles, setRoles] = useState([]);
  const [menus, setMenus] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [checked, setChecked] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesData, menusData] = await Promise.all([
          api.getRoles(),
          api.getMenus(),
        ]);
        setRoles(rolesData);
        setMenus(menusData);
      } catch (err) {
        toast.error("Failed to fetch data");
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      api
        .getRoleAccess(selectedRole)
        .then(setChecked)
        .catch(() => setChecked([]));
    } else {
      setChecked([]);
    }
  }, [selectedRole]);

  const toggle = (menuId) =>
    setChecked((prev) =>
      prev.includes(menuId)
        ? prev.filter((x) => x !== menuId)
        : [...prev, menuId]
    );

  const handleSave = async () => {
    if (!selectedRole) return toast.warning("Select Role");
    setLoading(true);
    try {
      await api.updateRoleAccess(selectedRole, checked);
      toast.success("Role access updated!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update access");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-body">
        <h5 className="card-title mb-3">Role Menu Access</h5>
        <select
          className="form-select mb-3"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          <option value="">Select Role</option>
          {roles.map((r) => (
            <option key={r._id} value={r._id}>
              {r.name}
            </option>
          ))}
        </select>
        <div className="row">
          {menus.map((m) => (
            <div key={m._id} className="col-md-4 col-6">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={checked.includes(m._id)}
                  onChange={() => toggle(m._id)}
                />
                <label className="form-check-label">{m.name}</label>
              </div>
            </div>
          ))}
        </div>
        {menus.length === 0 && <p className="text-muted">No menus available</p>}
        <button
          className="btn btn-success mt-3"
          onClick={handleSave}
          disabled={loading || !selectedRole}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function UserMenuAccess() {
  const [users, setUsers] = useState([]);
  const [menus, setMenus] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [checked, setChecked] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersData, menusData] = await Promise.all([
          api.getUsers(),
          api.getMenus(),
        ]);
        setUsers(usersData);
        setMenus(menusData);
      } catch (err) {
        toast.error("Failed to fetch data");
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedUser) {
      setChecked([]);
      return;
    }
    const loadAccess = async () => {
      try {
        const user = users.find((u) => u._id === selectedUser);
        if (!user) return;
        const roleMenus = user.role_id
          ? await api.getRoleAccess(user.role_id._id || user.role_id)
          : [];
        const userMenus = await api.getUserAccess(selectedUser);
        setChecked([...new Set([...roleMenus, ...userMenus])]);
      } catch (err) {
        setChecked([]);
      }
    };
    loadAccess();
  }, [selectedUser, users]);

  const toggle = (menuId) =>
    setChecked((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );

  const handleSave = async () => {
    if (!selectedUser) return toast.warning("Select User");
    setLoading(true);
    try {
      await api.updateUserAccess(selectedUser, checked);
      toast.success("User access updated!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update access");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-body">
        <h5 className="card-title mb-3">User Menu Access</h5>
        <select
          className="form-select mb-3"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="">Select User</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} ({u.role_id?.name || "No Role"})
            </option>
          ))}
        </select>
        <div className="row">
          {menus.map((m) => (
            <div key={m._id} className="col-md-4 col-6">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={checked.includes(m._id)}
                  onChange={() => toggle(m._id)}
                />
                <label className="form-check-label">{m.name}</label>
              </div>
            </div>
          ))}
        </div>
        {menus.length === 0 && <p className="text-muted">No menus available</p>}
        <button
          className="btn btn-success mt-3"
          onClick={handleSave}
          disabled={loading || !selectedUser}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function RBACAdminPage() {
  return (
    <div className="container py-4">
      <h3 className="mb-4">RBAC Management</h3>
      <RoleManager />
      <MenuManager />
      <RoleMenuAccess />
      <UserMenuAccess />
    </div>
  );
}
