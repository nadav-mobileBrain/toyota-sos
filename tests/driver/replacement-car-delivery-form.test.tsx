import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReplacementCarDeliveryForm } from '@/components/driver/ReplacementCarDeliveryForm';
import { act } from 'react-dom/test-utils';

// Mock signature_pad
jest.mock('signature_pad', () => {
  return class MockSignaturePad {
    canvas: HTMLCanvasElement;
    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
    }
    clear = jest.fn();
    isEmpty = jest.fn().mockReturnValue(false); // default not empty for success path
    toDataURL = jest
      .fn()
      .mockReturnValue('data:image/png;base64,mocksignature');
    off = jest.fn();
    on = jest.fn();
  };
});

// Mock ImageUpload
jest.mock('@/components/driver/ImageUpload', () => ({
  ImageUpload: ({ onUploaded, label }: any) => (
    <div data-testid="mock-image-upload">
      <button
        onClick={() =>
          onUploaded([
            {
              path: 'mock/path.jpg',
              signedUrl: 'http://mock/url.jpg',
              name: 'mock.jpg',
              size: 1000,
              contentType: 'image/jpeg',
            },
          ])
        }
      >
        Upload {label}
      </button>
    </div>
  ),
}));

// Mock Supabase
const uploadMock = jest
  .fn()
  .mockResolvedValue({ data: { path: 'ok' }, error: null });
const getPublicUrlMock = jest
  .fn()
  .mockReturnValue({ data: { publicUrl: 'http://supa/sig.png' } });
const insertMock = jest.fn().mockResolvedValue({ error: null });
const getUserMock = jest
  .fn()
  .mockResolvedValue({ data: { user: { id: 'driver-1' } } });

jest.mock('@/lib/auth', () => ({
  createBrowserClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
    from: () => ({
      insert: insertMock,
    }),
    auth: {
      getUser: getUserMock,
    },
  }),
}));

// Mock Analytics
jest.mock('@/lib/events', () => ({
  trackSignatureCaptured: jest.fn(),
}));

describe('ReplacementCarDeliveryForm', () => {
  const mockTask: any = {
    id: 'task-1',
    title: 'Test Task',
    vehicle: { licensePlate: '11-222-33', model: 'Toyota' },
    clientName: 'John Doe',
  };
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      scale: jest.fn(),
    });
  });

  test('renders step 0 and requires car photos', async () => {
    render(
      <ReplacementCarDeliveryForm
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByText('מסירת רכב חלופי - שלב 1 מתוך 3')
    ).toBeInTheDocument();
    expect(screen.getByText('צילום הרכב')).toBeInTheDocument();

    // Try next without upload
    const nextBtn = screen.getByText('המשך');
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    await userEvent.click(nextBtn);
    expect(alertMock).toHaveBeenCalledWith('יש להעלות לפחות תמונה אחת של הרכב');

    // Upload
    await userEvent.click(screen.getByText('Upload צלם/י תמונות'));
    expect(screen.getByText('1 תמונות הועלו בהצלחה')).toBeInTheDocument();

    // Next
    await userEvent.click(nextBtn);
    expect(
      screen.getByText('מסירת רכב חלופי - שלב 2 מתוך 3')
    ).toBeInTheDocument();
  });

  test('renders step 1 and requires license photo', async () => {
    render(
      <ReplacementCarDeliveryForm
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onSubmit={mockOnSubmit}
      />
    );

    // Skip step 0
    await userEvent.click(screen.getByText('Upload צלם/י תמונות'));
    await userEvent.click(screen.getByText('המשך'));

    expect(screen.getByText('צילום רישיון נהיגה')).toBeInTheDocument();

    // Try next without upload
    const nextBtn = screen.getByText('המשך');
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    await userEvent.click(nextBtn);
    expect(alertMock).toHaveBeenCalledWith('יש להעלות צילום רישיון נהיגה');

    // Upload
    await userEvent.click(screen.getByText('Upload צלם/י רישיון'));
    expect(screen.getByText('רישיון הועלה בהצלחה')).toBeInTheDocument();

    // Next
    await userEvent.click(nextBtn);
    expect(
      screen.getByText('מסירת רכב חלופי - שלב 3 מתוך 3')
    ).toBeInTheDocument();
  });

  test('renders step 2 (summary) and submits signature', async () => {
    // Setup fetches
    (global.fetch as jest.Mock) = jest.fn(() =>
      Promise.resolve({
        blob: () => Promise.resolve(new Blob(['fake'], { type: 'image/png' })),
      })
    );

    render(
      <ReplacementCarDeliveryForm
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onSubmit={mockOnSubmit}
      />
    );

    // Step 0
    await userEvent.click(screen.getByText('Upload צלם/י תמונות'));
    await userEvent.click(screen.getByText('המשך'));
    // Step 1
    await userEvent.click(screen.getByText('Upload צלם/י רישיון'));
    await userEvent.click(screen.getByText('המשך'));

    // Step 2
    expect(screen.getByText('אישור וחתימה')).toBeInTheDocument();
    expect(screen.getByText('11-222-33')).toBeInTheDocument(); // license plate

    // Submit
    const submitBtn = screen.getByText('סיים ומסור רכב');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled(); // DB insert signature
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });
});
