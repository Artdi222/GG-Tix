export default defineEventHandler(() => {
  // TODO: replace with a real query once the backend endpoint is ready
  return [
    { id: 1, name: 'Lumina Stage - Golden Night', date: '2026-09-12', venue: 'Istora Senayan', ticketsSold: 1240, capacity: 1500, status: 'on-sale' },
    { id: 2, name: 'Lumina Stage - Starlight Tour Jakarta', date: '2026-10-05', venue: 'The Kasablanka Hall', ticketsSold: 1380, capacity: 1400, status: 'almost-sold-out' },
    { id: 3, name: 'Lumina Stage - Winter Glow', date: '2026-12-20', venue: 'ICE BSD', ticketsSold: 860, capacity: 2000, status: 'on-sale' },
    { id: 4, name: 'Lumina Stage - Acoustic Night', date: '2026-07-18', venue: 'Balai Sarbini', ticketsSold: 500, capacity: 500, status: 'sold-out' },
    { id: 5, name: 'Lumina Stage - Fan Meeting Vol. 1', date: '2026-08-30', venue: 'Djakarta Theater', ticketsSold: 0, capacity: 800, status: 'draft' }
  ]
})