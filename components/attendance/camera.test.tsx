// @vitest-environment jsdom
import { act,cleanup,render,waitFor } from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({read:null as null|((code:string)=>void),stop:vi.fn(),now:10000}));
vi.mock('html5-qrcode',()=>({Html5Qrcode:class {isScanning=true;start(_device:unknown,_config:unknown,read:(code:string)=>void){m.read=read;return Promise.resolve();}stop(){m.stop();return Promise.resolve();}}}));
import {AttendanceCamera} from './camera';
beforeEach(()=>{m.read=null;m.now=10000;m.stop.mockClear();vi.spyOn(Date,'now').mockImplementation(()=>m.now);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('keeps reading distinct IDs, suppresses rapid repeated frames, pauses while disabled, and stops on unmount',async()=>{const read=vi.fn(),close=vi.fn();const view=render(<AttendanceCamera continuous onRead={read} onClose={close}/>);await waitFor(()=>expect(m.read).toBeTruthy());act(()=>{m.read!('700');m.read!('700');m.read!('600');});expect(read.mock.calls.map(c=>c[0])).toEqual(['700','600']);view.rerender(<AttendanceCamera continuous disabled onRead={read} onClose={close}/>);act(()=>{m.now+=3000;m.read!('900');});expect(read).toHaveBeenCalledTimes(2);view.rerender(<AttendanceCamera continuous onRead={read} onClose={close}/>);act(()=>m.read!('700'));expect(read).toHaveBeenCalledTimes(3);view.unmount();expect(m.stop).toHaveBeenCalledTimes(1);});
it('preserves one-shot callers',async()=>{const read=vi.fn();render(<AttendanceCamera onRead={read} onClose={()=>{}}/>);await waitFor(()=>expect(m.read).toBeTruthy());act(()=>{m.read!('700');m.read!('600');});expect(read).toHaveBeenCalledTimes(1);});
