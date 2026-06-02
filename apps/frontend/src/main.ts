import { mount } from 'svelte';
import './app.css';
import './lib/ui/design-tokens.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
