import type { User } from '../config';
import { renderLayout } from './layout';

export interface UsersPageProps {
  user: User;
  users: User[];
  enableAds?: boolean;
}

export function renderUsersPage({ user, users, enableAds = true }: UsersPageProps): string {
  return renderLayout({
    title: 'Users - Muslim Space Link',
    user,
    activeNav: 'users',
    enableAds,
    children: `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Users</h1>
            <p class="text-gray-500 mt-1">Manage user accounts and permissions</p>
          </div>
          <button
            onclick="document.getElementById('new-user-modal').classList.remove('hidden')"
            class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Add User
          </button>
        </div>

        <!-- Users Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${users.map(u => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <span class="text-emerald-700 font-medium text-sm">${u.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span class="font-medium text-gray-900">${u.name}</span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-gray-600">${u.email}</td>
                    <td class="px-6 py-4">
                      <span class="px-2 py-1 text-xs rounded-full ${u.role === 'owner' ? 'bg-purple-100 text-purple-700' : u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">
                        ${u.role}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      ${new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4">
                      ${u.id !== user.id ? `
                        <div class="flex items-center gap-3">
                          <button
                            onclick="document.getElementById('edit-user-${u.id}').classList.remove('hidden')"
                            class="text-emerald-600 hover:text-emerald-700 text-sm"
                          >
                            Edit
                          </button>
                          <form method="POST" action="/admin/users/${u.id}/delete" class="inline">
                            <button type="submit" class="text-red-600 hover:text-red-700 text-sm">Delete</button>
                          </form>
                        </div>
                      ` : '<span class="text-gray-400 text-sm">You</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- New User Modal -->
      <div id="new-user-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <form method="POST" action="/admin/users">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-xl font-bold text-gray-900">Add New User</h2>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" name="name" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" name="email" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" name="password" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
              </div>
              <div>
                <label for="role" class="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select name="role" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div class="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button type="button" onclick="document.getElementById('new-user-modal').classList.add('hidden')" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                Create User
              </button>
            </div>
          </form>
        </div>
      </div>
    `,
  });
}