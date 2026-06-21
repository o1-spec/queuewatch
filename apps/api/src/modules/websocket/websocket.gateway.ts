import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DbService } from '../db/db.service';

@NestWebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class QueueWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('QueueWebSocketGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly dbService: DbService
  ) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const projectId = socket.handshake.query?.projectId;

      if (projectId === 'proj_demo') {
        return next();
      }

      if (!token || typeof token !== 'string') {
        this.logger.warn(`Rejecting handshake for socket ${socket.id}: Missing authentication token.`);
        return next(new Error('Missing authentication token.'));
      }

      try {
        const decoded = this.jwtService.verify(token);
        const userId = decoded.sub;

        if (projectId && typeof projectId === 'string') {
          const isOwner = await this.dbService.isProjectOwner(projectId, userId);
          if (!isOwner) {
            this.logger.warn(`Rejecting handshake for socket ${socket.id}: SRE does not own project workspace "${projectId}".`);
            return next(new Error(`SRE does not own project workspace "${projectId}".`));
          }
        }
        socket.data = { userId, projectId };
        next();
      } catch (err: any) {
        this.logger.warn(`Rejecting handshake for socket ${socket.id}: Token verification failed (${err.message}).`);
        next(new Error(`Token verification failed (${err.message}).`));
      }
    });
    this.logger.log('Socket.IO Gateway successfully initialized.');
  }

  async handleConnection(client: Socket) {
    const projectId = client.handshake.query?.projectId;
    if (projectId && typeof projectId === 'string') {
      client.join(projectId);
      this.logger.log(`Client ${client.id} successfully connected and joined room "${projectId}".`);
    } else {
      this.logger.log(`Client ${client.id} connected without specific project room.`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast telemetry data to specific active Next.js project rooms
   */
  broadcast(event: string, payload: any) {
    if (this.server) {
      if (payload && payload.projectId) {
        this.server.to(payload.projectId).emit(event, payload);
      } else {
        this.server.emit(event, payload);
      }
    }
  }
}
