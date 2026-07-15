import { createTheme } from '@mui/material/styles';

// Material Design theme, branded from the reference design.
// primary = brand teal · secondary = amber (the main "action" color) ·
// semantic error/success/warning. Heebo typography. RTL.
export const theme = createTheme({
  direction: 'rtl',
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: '#0a7d88',
      light: '#0e9aa7',
      dark: '#096a74',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ef8a46',
      light: '#f7a56a',
      dark: '#e08a00',
      contrastText: '#ffffff',
    },
    error: { main: '#dc2626', light: '#fdecec', dark: '#8e1616' },
    success: { main: '#16a34a', light: '#e7f6ec', dark: '#157f3b' },
    warning: { main: '#e08a00', light: '#fef3e0', dark: '#b8730a' },
    info: { main: '#0e9aa7' },
    background: { default: '#f4f7f8', paper: '#ffffff' },
    text: { primary: '#1c2b2e', secondary: '#5b6b6e', disabled: '#a9b7b9' },
    divider: '#e7edee',
    grey: {
      50: '#f4f7f8',
      100: '#e7edee',
      200: '#c7d2d3',
      300: '#a9b7b9',
      400: '#8a9a9c',
      500: '#5b6b6e',
      600: '#46595c',
      700: '#33474a',
      800: '#26383b',
      900: '#1c2b2e',
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'Heebo', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
    h1: { fontWeight: 800, fontSize: '32px', letterSpacing: '-0.6px' },
    h2: { fontWeight: 800, fontSize: '26px', letterSpacing: '-0.4px' },
    h3: { fontWeight: 700, fontSize: '20px' },
    h4: { fontWeight: 700, fontSize: '18px' },
    h5: { fontWeight: 700, fontSize: '16px' },
    h6: { fontWeight: 700, fontSize: '15px' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, color: '#5b6b6e' },
    body1: { fontSize: '15px' },
    body2: { fontSize: '13.5px', color: '#5b6b6e' },
    button: { textTransform: 'none', fontWeight: 700, fontSize: '14px' },
    caption: { fontSize: '12.5px', color: '#8a9a9c' },
    overline: { fontWeight: 700, letterSpacing: '0.12em', color: '#0a7d88' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 44, paddingInline: 20 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: '1px solid #e7edee',
          boxShadow: '0 2px 10px rgba(20,50,55,0.05), 0 1px 3px rgba(20,50,55,0.06)',
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: '11.5px', height: 24 },
        label: { paddingInline: 10 },
      },
    },
    MuiTextField: { defaultProps: { variant: 'outlined', fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10, backgroundColor: '#fff' },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(244,247,248,0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e7edee',
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});
