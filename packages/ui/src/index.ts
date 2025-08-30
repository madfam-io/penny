// Placeholder UI components for build
import React from 'react';

export const Button = ({ children, ...props }: any) => {
  return React.createElement('button', props, children);
};

export const Card = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const CardHeader = Card;
export const CardTitle = Card;
export const CardDescription = Card;
export const CardContent = Card;
export const CardFooter = Card;

export const Badge = ({ children, ...props }: any) => {
  return React.createElement('span', props, children);
};

export const Progress = ({ value, ...props }: any) => {
  return React.createElement('div', props);
};

export const Modal = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};