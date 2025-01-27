
import { LitElement, html } from 'lit';
import { state, customElement, property } from 'lit/decorators.js';
import { InstalledCell, AppWebsocket, EntryHash, InstalledAppInfo, AgentPubKey, AppSignal } from '@holochain/client';
import { contextProvided } from '@lit-labs/context';
import { appInfoContext, appWebsocketContext } from '../contexts';
import { serializeHash, deserializeHash } from '@holochain-open-dev/utils';
import { Message } from '../types/chat';

interface ChatBufferElement {
  timestamp: number,
  payload: string,
}

@customElement('chat-bubble')
export class ChatBubble extends LitElement {

  @contextProvided({ context: appWebsocketContext })
  appWebsocket!: AppWebsocket;

  @contextProvided({ context: appInfoContext })
  appInfo!: InstalledAppInfo;

  @property()
  channel!: string;

  @state()
  chatBuffer!: ChatBufferElement[];

  @property()
  username!: string;

  @property()
  avatarUrl!: string;

  @property()
  agentPubKey!: string;


  addToBuffer(msg: Message) {
    let chatBufferElement = {
      timestamp: msg.timestamp,
      payload: msg.payload
    };
    // let newBuffer = this.chatBuffer.concat(chatBufferElement);
    this.chatBuffer = [...this.chatBuffer, chatBufferElement];
    this.printBuffer();
  }

  updateBuffer() {

  }

  sortBuffer() {
    let sortedBuffer = this.chatBuffer.sort((a,b) => {
      return b.timestamp - a.timestamp;
    });
    this.chatBuffer = sortedBuffer;
  }

  bufferToString() {
    return this.chatBuffer.map(chatBufferObj => {
      return chatBufferObj.payload;
    }).join("");
  }

  printBuffer() {
    console.log(this.bufferToString());
  }


  async signalCallback(signalInput: AppSignal) {

    let msg: Message = signalInput.data.payload;

    const sameAgent = serializeHash(msg.senderKey) == this.agentPubKey;
    const sameChannel = this.channel == msg.secret;
    if (sameAgent && sameChannel) {
      this.addToBuffer(msg);
      console.log(this.bufferToString());
    }

    console.log(signalInput);
    (window as any).signalInput = signalInput;
    // alert(signalInput.data.payload.payload);
  }

  async firstUpdated() {
    this.appWebsocket = await AppWebsocket.connect(
      `ws://localhost:${process.env.HC_PORT}`,
      undefined, // timeout
      this.signalCallback,
    );

    this.appInfo = await this.appWebsocket.appInfo({
      installed_app_id: 'burner-chat',
    });

  }


  render() {
    return html`
      <div class="chat-bubble">
        <p>${this.channel} ${this.username}</p>
        <p class="chat-area"></p>
        <img src=${this.avatarUrl} width="50" height="50"/>
      </div>
    `
    // if (!this._entryDef0) {
    //   return html`<div style="display: flex; flex: 1; align-items: center; justify-content: center">
    //     <mwc-circular-progress indeterminate></mwc-circular-progress>
    //   </div>`;
    // }

    // return html`
    //   <div style="display: flex; flex-direction: column">
    //     <span style="font-size: 18px">EntryDef0</span>


    // <title-detail

    // .value=${this._entryDef0.title}
    //   style="margin-top: 16px"
    // ></title-detail>


    // <content-detail

    // .value=${this._entryDef0.content}
    //   style="margin-top: 16px"
    // ></content-detail>

    //   </div>
    // `;
  }
}
