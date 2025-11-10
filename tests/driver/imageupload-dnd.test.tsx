import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from '@/components/driver/ImageUpload';

function createFile(name: string, type: string, size = 1234) {
  const file = new File(['x'.repeat(size)], name, { type });
  Object.defineProperty(file, 'lastModified', { value: 1700000000000 });
  return file;
}

describe('ImageUpload drag-and-drop (5.4.2)', () => {
  test('highlights on dragover and merges dropped files, dedupes by id', async () => {
    const onChange = jest.fn();
    render(<ImageUpload onChange={onChange} />);

    const dropzone = screen.getByLabelText('אזור העלאת תמונות');

    // drag enter/over highlights
    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [] } });
    expect(dropzone.className).toMatch(/border-toyota-primary/);
    fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } });
    expect(dropzone.className).toMatch(/bg-red-50/);

    const f1 = createFile('a.png', 'image/png', 10);
    const f2 = createFile('b.jpg', 'image/jpeg', 20);
    const data = { files: [f1, f2] } as unknown as DataTransfer;
    fireEvent.drop(dropzone, { dataTransfer: data });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const first = onChange.mock.calls[0][0];
    expect(first).toHaveLength(2);

    // dragleave removes highlight
    fireEvent.dragLeave(dropzone);
    expect(dropzone.className).not.toMatch(/bg-red-50/);

    // Drop duplicate file; should dedupe by id
    fireEvent.drop(dropzone, { dataTransfer: { files: [f1] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    const second = onChange.mock.calls[1][0];
    expect(second).toHaveLength(2);
  });
});


