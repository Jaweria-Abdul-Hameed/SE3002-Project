// The key screen of each use case, shared by the axe-core scan (Playwright) and the Lighthouse flow
// (puppeteer-core). Each screen says who is signed in, which URL to open, and which click (if any) opens a dialog.
export const SCREENS = [
  { id: 'KS1', useCase: 'UC-1 Submit a request', user: 'requester1', url: '/app/requests', open: { button: 'Request' }, label: 'Add Request dialog (requester)' },
  { id: 'KS2', useCase: 'UC-2 Approve a request', user: 'admin', url: '/app/requests/{pending}', label: 'Request details with Approve/Reject (admin)' },
  { id: 'KS3', useCase: 'UC-3 Reject with feedback', user: 'admin', url: '/app/requests/{pending}', open: { button: 'Reject' }, label: 'Reject dialog with Feedback (admin)' },
  { id: 'KS4', useCase: 'UC-4 Follow my request', user: 'requester1', url: '/app/requests', label: 'Requests list (requester)' },
  { id: 'KS5', useCase: 'UC-5 Edit a pending request', user: 'requester1', url: '/app/requests/{pending}', open: { editIcon: true }, label: 'Edit request dialog (creator)' },
  { id: 'KS6', useCase: 'UC-6 Supervise the queue', user: 'limitedAdmin', url: '/app/requests', label: 'Requests queue (limited admin)' },
];
