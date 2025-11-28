import { Socket } from 'socket.io-client';
import { SocketEvents } from '@sq/shared';

class Logger {
  private socket: Socket | null = null;

  setSocket(socket: Socket) {
    this.socket = socket;
  }

  info(message: string, meta?: any) {
    // eslint-disable-next-line no-console
    console.log(message, meta || '');
    this.emit('info', message, meta);
  }

  warn(message: string, meta?: any) {
    // eslint-disable-next-line no-console
    console.warn(message, meta || '');
    this.emit('warn', message, meta);
  }

  error(message: string, meta?: any) {
    // eslint-disable-next-line no-console
    console.error(message, meta || '');
    this.emit('error', message, meta);
  }

  private emit(level: string, message: string, meta?: any) {
    if (this.socket && this.socket.connected) {
        // We don't want logging to cause recursion or crash
        try {
            this.socket.emit(SocketEvents.CLIENT_LOG, { level, message, ...meta });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to send log to server', e);
        }
    }
  }
}

export const logger = new Logger();

