import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import App from '../../src/App';

describe('App Component', () => {
  it('renders correctly', () => {
    const { getAllByText } = render(<App />);
    expect(getAllByText('AppVid').length).toBeGreaterThan(0);
  });
});
