import '@webcomponents/scoped-custom-element-registry';

import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import {
  AgentPubKey,
  AppSignal,
  AppWebsocket,
  EntryHash,
  InstalledAppInfo,
  InstalledCell,
} from '@holochain/client';
import { contextProvider } from '@lit-labs/context';
import '@material/mwc-circular-progress';

import { get } from 'svelte/store';
import { appWebsocketContext, appInfoContext, burnerServiceContext } from './contexts';
import { serializeHash, deserializeHash } from '@holochain-open-dev/utils';
import { MessageInput } from './types/chat';
import { ChatScreen } from './components/chat-screen';
// import { BurnerStore } from './burner-store';
import { BurnerService } from './burner-service';
import { CellClient, HolochainClient } from '@holochain-open-dev/cell-client';
import { BurnerServiceContext } from './components/service-context';

@customElement('holochain-app')
export class HolochainApp extends LitElement {
  @state() loading = true;
  @state() entryHash: EntryHash | undefined;

  @contextProvider({ context: appWebsocketContext })
  @property({ type: Object })
  appWebsocket!: AppWebsocket;

  @contextProvider({ context: appInfoContext })
  @property({ type: Object })
  appInfo!: InstalledAppInfo;

  @contextProvider({ context: burnerServiceContext })
  @property({ type: Object })
  service!: BurnerService;

  @query("chat-screen")
  chatScreen!: ChatScreen;

  @query("#test-signal-text-input")
  textInputField!: HTMLInputElement;

  @query("#test-recipient-input")
  recipientInputField!: HTMLInputElement;

  @query("#channel-secret-input")
  channelSecretInputField!: HTMLInputElement;

  @state()
  allMyChannels!: string[];

  @state()
  myAgentPubKey!: string;

  @state()
  myUsername: string | undefined;

  @state()
  activeChannel: string | undefined;

  @state()
  activeChannelMembers: string[] = [];

  // service!: BurnerService;
  async dispatchTestSignal() {
    // get the input from the input text field
    const input = this.textInputField.value;
    // copied from boiulerplate
    const cellData = this.appInfo.cell_data.find((c: InstalledCell) => c.role_id === 'burner_chat')!;
    await this.appWebsocket.callZome({
      cap_secret: null,
      cell_id: cellData.cell_id,
      zome_name: 'chat',
      fn_name: 'signal_test',
      payload: input,
      provenance: cellData.cell_id[1]
    });
  }

  async dispatchRealtimeSignal(ev: KeyboardEvent) {
    // get character from
    (window as any).ev = ev;
    if (!ev.key.match(/^[A-Za-z0-9_.+/><\\?!$-:;]$/g)) {
      return;
    }
    // const msgText = this.textInputField.value;
    // const recipient = this.recipientInputField.value;
    console.log(ev.key);
    const msgText = this.textInputField.value;
    const recipient = this.recipientInputField.value;
    const msgInput: MessageInput = {
      payload: msgText,
      senderName: "sender",
      recipients: [deserializeHash(recipient)],
      secret: "secret",
    }
    const cellData = this.appInfo.cell_data.find((c: InstalledCell) => c.role_id === 'burner_chat')!;
    await this.appWebsocket.callZome({
      cap_secret: null,
      cell_id: cellData.cell_id,
      zome_name: 'chat',
      fn_name: 'send_msg',
      payload: msgInput,
      provenance: cellData.cell_id[1]
    });
  }

  async sendRemoteSignal() {
    const msgText = this.textInputField.value;
    const recipient = this.recipientInputField.value;
    const msgInput: MessageInput = {
      payload: msgText,
      senderName: "sender",
      recipients: [deserializeHash(recipient)],
      secret: "secret",
    }

    const cellData = this.appInfo.cell_data.find((c: InstalledCell) => c.role_id === 'burner_chat')!;
    await this.appWebsocket.callZome({
      cap_secret: null,
      cell_id: cellData.cell_id,
      zome_name: 'chat',
      fn_name: 'send_msg',
      payload: msgInput,
      provenance: cellData.cell_id[1]
    });
  }

  async burnChannel() {
    const channelToBurn = this.activeChannel;
    if (!channelToBurn) {
      return;
    }
    const allMyChannelsFiltered = this.allMyChannels.filter(channel => channel !== channelToBurn);
    await this.service.burnChannel(channelToBurn);
    this.allMyChannels = allMyChannelsFiltered;
    this.activeChannel = undefined;
  }

  // filter signals
  async signalCallback(signalInput: AppSignal) {
    // filter only current room

    //

    // console.log(signalInput);
    // (window as any).signalInput = signalInput;
  }

  async firstUpdated() {
    this.activeChannel = "random";

    this.appWebsocket = await AppWebsocket.connect(
      `ws://localhost:${process.env.HC_PORT}`,
      undefined, // timeout
      this.signalCallback,
    );

    this.appInfo = await this.appWebsocket.appInfo({
      installed_app_id: 'burner-chat',
    });

    const cellData = this.appInfo.cell_data.find((c: InstalledCell) => c.role_id === 'burner_chat')!;
    this.myAgentPubKey = serializeHash(cellData.cell_id[1]);

    const cell = this.appInfo.cell_data.find(c => c.role_id === 'burner_chat');
    const client = new HolochainClient(this.appWebsocket);
    const cellClient = new CellClient(client, cell!);

    this.service = new BurnerService(cellClient);
    console.log("SETTING SERVICE INSIDE HOLOCH");
    console.log(this.service);

    this.loading = false;
  }

  async joinChannel(channelToJoin: string): Promise<void> {
    if (this.allMyChannels.includes(channelToJoin)) {
      return;
    }
    await this.service.joinChannel(channelToJoin);
    const channelMembers = await this.service.getChannelMembers(channelToJoin);
    const channelMembersB64 = channelMembers.map(pubkey => serializeHash(pubkey));
    this.activeChannelMembers = channelMembersB64;
    this.allMyChannels = [...this.allMyChannels, channelToJoin];
  }

  renderLandingPage() {
    return html`
      <h1>Hello from landing Page</h1>
    `;
  }

  renderChatScreen() {
    return html`
      <chat-screen 
        .channel=${this.activeChannel}
      ></chat-screen>
    `
  }

  render() {
    if (this.loading) {
      return html`
        <mwc-circular-progress indeterminate></mwc-circular-progress>
      `;
    }

    // console.log("CHANNEL MEMBERS: ", this.channelMembers);

    // Landing Page
    // Chat Screen
    //    => bubbles
    //    => my own buuble

    return html`
      <main>
        ${this.activeChannel 
          ? this.renderChatScreen()
          : this.renderLandingPage()
        }
      </main>
    `
    // return html`
    //   <main>
    //     <h1 class="main-title">🔥 BURNER CHAT</h1>
    //     <chat-screen channel="my-random-channel"></chat-screen>
    //     <input id="test-signal-text-input" type="text" placeholder="your message..." />
    //     <input id="test-recipient-input" type="text" placeholder="recipient pubkey"/>
    //     <div>My key: ${this.myAgentPubKey}</div>
    //     <div>
    //       <input id="channel-secret-input" type="text" placeholder="Channel secret"/>
    //       <button @click=${this.joinChannel}>Join Channel</button>
    //     </div>
    //     <div>MEMBERS:
    //     ${
    //       this.channelMembers.forEach((member) => {
    //         html`<div>${member}</div>`
    //       })
    //     }
    //     </div>
    //     <button @click=${this.burnChannel}>+ + + B U R N  + + +  C H A N N E L + + +</button>
    //     <button class="bttn-test-signal"
    //       @click=${this.sendRemoteSignal}>
    //        Send Remote Signal
    //     </button><br>
    //     <br>
    //     <button class="bttn-test-signal"
    //       @click=${this.dispatchTestSignal}>
    //         Signal Test
    //     </button>

    //     <br><br>
    //     <p>realtime signals</p>
    //     <input id="realtime-chat-test" type="text"
    //     @keyup=${this.dispatchRealtimeSignal}/>
    //     <h3>MESSAGE STREAM</h3>
    //     <p class="message-stream"></p>
    //     <create-entry-def-0 @entry-def-0-created=${(e: CustomEvent) => this.entryHash = e.detail.entryHash}></create-entry-def-0>
    // ${this.entryHash ? html`
    //   <entry-def-0-detail .entryHash=${this.entryHash}></entry-def-0-detail>
    // ` : html``}
    //   </main>
    // `;
  }

  static styles = css`
    :host {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      font-size: calc(10px + 2vmin);
      color: #1a2b42;
      max-width: 960px;
      margin: 0 auto;
      text-align: center;
      background-color: var(--lit-element-background-color);
    }

    main {
      flex-grow: 1;
    }

    .app-footer {
      font-size: calc(12px + 0.5vmin);
      align-items: center;
    }

    .app-footer a {
      margin-left: 5px;
    }

    .main-title {
      font-family: 'Rubik', monospace;
      font-weight: bold;
      letter-spacing: 4px;
      color: #6737FF;
    }
  `;

  static get scopedElements() {
    return {
      "chat-screen": ChatScreen,
      "burner-service-context": BurnerServiceContext,
    }
  }
}


/**
LOADED FONTS, use like this
font-family: 'Roboto Mono', monospace;
font-family: 'Rubik', sans-serif;
 */