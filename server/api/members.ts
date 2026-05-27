const members = [{
  name: 'Dan',
  username: 'dan',
  role: 'owner',
  avatar: { icon: 'i-lucide-user-round' }
}, {
  name: 'Support Desk',
  username: 'support',
  role: 'member',
  avatar: { icon: 'i-lucide-life-buoy' }
}, {
  name: 'Delivery Lead',
  username: 'delivery',
  role: 'member',
  avatar: { icon: 'i-lucide-list-checks' }
}, {
  name: 'Finance Admin',
  username: 'finance',
  role: 'member',
  avatar: { icon: 'i-lucide-receipt' }
}]

export default eventHandler(async () => {
  return members
})
