import { createHashRouter, RouterProvider } from 'react-router-dom';

import { WorkspacePage } from './routes/workspace';
import { PaperPage } from './routes/paper';
import { ReviewPage } from './routes/review';

const router = createHashRouter([
  { path: '/', element: <WorkspacePage /> },
  { path: '/papers/:paperId', element: <PaperPage /> },
  { path: '/review', element: <ReviewPage /> }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
