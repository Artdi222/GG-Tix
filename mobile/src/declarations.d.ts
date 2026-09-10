// ponytail: ambient module declarations for CSS in Expo Web
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css';
