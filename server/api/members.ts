const members = [{
  name: 'Dan',
  username: 'dan',
  role: 'owner',
  billing_role: 'billing_admin',
  avatar: { icon: 'i-lucide-user-round' }
}, {
  name: 'Support Desk',
  username: 'support',
  role: 'member',
  billing_role: 'billing_viewer',
  avatar: { icon: 'i-lucide-life-buoy' }
}, {
  name: 'Delivery Lead',
  username: 'delivery',
  role: 'member',
  billing_role: null,
  avatar: { icon: 'i-lucide-list-checks' }
}, {
  name: 'Finance Admin',
  username: 'finance',
  role: 'member',
  billing_role: 'billing_admin',
  avatar: { icon: 'i-lucide-receipt' }
}]

export default eventHandler(async () => {
  return members
})
