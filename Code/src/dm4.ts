import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure";
import { DMContext, DMEvents } from "./types";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://lab4lt2216.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview",
  key: NLU_KEY,
  deploymentName: "lab4assignment",
  projectName: "lab4",
}

const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials,
  azureCredentials: azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-GB",
  ttsDefaultVoice: "en-US-DavisNeural",
};

// interface CLUResult {
//     topIntent: string;
//     intents: Record<string, {confidence: number}>;
//     entities: {
//         person?: Array<{text: string, category: string}>;
//         day?: Array<{text: string, category: string}>;
//         time?: Array<{text: string, category: string}>;
//     }
// }

interface YesNoEntry {
    yes?: string;
    no?: string;
}

const yesNo: {[index: string]: YesNoEntry} = {
    yes: {yes: "yes" },
    yeah: {yes: "yeah"},
    correct: {yes: "correct"},
    sure: {yes: "sure"},
    no: {no: "no"},
    wrong: {no: "wrong"},
    incorrect: {no: "incorrect"},
}

const isAffirmative = (utterance: string): boolean => {
    return utterance in yesNo && !!yesNo[utterance].yes;
};

const isNegative = (utterance: string): boolean => {
    return utterance in yesNo && !!yesNo[utterance].no;
};

interface information {
    information?: string;
    person?: string;
}

const PersonInformation: {[index: string]: information} = {
    mickey: { person: "Mickey Mouse", information: "Mickey is supposed to be the seneible one, but at times he is as dilutional as Pluto" },
    chip: { person: "Chip", information: "Chip is very funny, and always in a mood to play pranks"},
    ariel: { person: "Ariel", information: "Ariel is bad at apprechiating what she ahs until it is gone" },
    goofy: {person: "Goofy", information: "Goofy likes to live in oblivion"},
    winney: {person: "Winney the Pooh", information: "Winney obsess about food, and can never be far away from her source of honey"},
    merida: {person: "Merida", information: "Merida is always up for a fun time, especially if it involves a bow and an arrow"},
    elsa: {person: "Elsa", information: "funny but a bit cold"},
    "daisy duck": {person: "Daisy Duck", information: "Daisy is chirpy, but to be honest I don't know much about her"},
    "donald duck": {person: "Donald Duck", information: "Donald gets easily annoyed, especially when something interrupts his rutines"},
    pluto: {person: "Pluto", information: "Pluto is a bit delusional, but loved by all except Chip"},
    rapunzel: {person: "Rapunzel", information: "Rapunzel cuts her hair once in a while when she feels rebellious"},
}

function getInformation(person: string) {
    return (PersonInformation[person.toLowerCase()] || {}).information;
}

function getPerson(nluValue: any) {
    if (nluValue !== null) {
        if (nluValue.entities.length > 0) {
            for (let i: number = 0; i < nluValue.entities.length; i++) {
                if (nluValue.entities[i].category == "name") {
                    return nluValue.entities[i].text
                }
            }
        }
    }
    return ""
}

function getDay(nluValue: any) {
    if (nluValue !== null) {
        if (nluValue.entities.length > 0) {
            for (let i: number = 0; i < nluValue.entities.length; i++) {
                if (nluValue.entities[i].category == "day") {
                    return nluValue.entities[i].text
                }
            }
        }
    }
    return null
}

function getTime(nluValue: any) {
    if (nluValue !== null) {
        if (nluValue.entities.length > 0) {
            for (let i: number = 0; i < nluValue.entities.length; i++) {
                console.log('test time' + nluValue.entities[i].text)
                if (nluValue.entities[i].category == "time") {
                    return nluValue.entities[i].text
                }
            }
        }
    }
    return null
}

const dmMachine = setup({
  types: {
    /** you might need to extend these */
    context: {} as DMContext & {pendingEntities: string[]},
    events: {} as DMEvents,
  },
  actions: {
    /** define your actions here */
    "spst.speak": ({ context }, params: { utterance: string }) => 
      context.spstRef.send({
        type: "SPEAK",
        value: {utterance: params.utterance},
      }),
    "spst.listen": ({ context }) => 
      context.spstRef.send({
        type: "LISTEN",
        value: {nlu: true},
      }),
    "extractEntities": function({event, context}) {
        if ("nluValue" in event) {
            if (context.person == null) {
                context.person = getPerson(event.nluValue);
            }
            if (context.day == null) {
                context.day = getDay(event.nluValue)
            }
            if (context.time == null) {
                context.time = getTime(event.nluValue)
            }
            //if (context.intent == null) {
            context.intent =event.nluValue.topIntent
            context.lastResult = event.value[0].utterance
            
        }
    }
  }
}).createMachine({
  /** specify the function for context */
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: "",
    person: "",
    day: null,
    time: null,
    intent: null,
    yes: null,
    no: null,
    information: null,
    pendingEntities: ["person", "day", "time"],
    isWholeDay: false
  }),

    id: "DM",
    initial: "Prepare",
    /** the states in the statemchine is created and their order, this contains the parentstates */
    states: {
    /** a prepare state where the machine prepares to start the process/link where the interface of the code is --> when done it moves to state "WaitToSart" */
        Prepare: {
        id: "Prepare",
        entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
        on: { ASRTTS_READY: "WaitToStart" },
        },
        /** state which starts the process if the button on screen is pressed */
        WaitToStart: {
        id: "WaitToStart",
        on: { CLICK: "Greeting" },
        },
    
        /** hear & listen greeeting action */
        Greeting: {
            id: "Greeting",
            initial: "prompt",
            on: {
                LISTEN_COMPLETE: [
                {target: "appointmentSystem",
                    guard: ({ context }) => context.intent === "Book an appointment",//recognise utterance as appointment,
                },
                {target: "whoQueriesSystem",
                guard: ({context}) => context.intent === "who is x",//recognise utterance as 'know more about a famous person'
                },
                { target: ".NoInput" },
                ],
            },
            states: {
                prompt: {
                entry: {type: "spst.speak", params: {utterance: "Hello, do you want to book an appointment or know more about a famous person?"}},
                on: {SPEAK_COMPLETE: "processing"}
                },
                NoInput: {
                entry: {type: "spst.speak", params: {utterance: "I could not hear you"}},
                on: {SPEAK_COMPLETE: "prompt"},
                },
                processing: {
                entry: {type: "spst.listen"},
                on: {RECOGNISED: {
                    actions: ["extractEntities"],
                    },
                    ASR_NOINPUT: {
                    actions: assign({intent: null})
                    },
                },
                },
            },
        },
        appointmentSystem: {
            id: "appointmentSystem",
            initial: "gatherInfo",
            states: {
                gatherInfo: {
                    always: [
                        {guard: ({context}) => !context.person,
                        target: "who"},
                        {guard: ({context}) => !context.day,
                        target: "day"},
                        {guard: ({context}) => !context.time,
                        target: "getTime"},
                        {target: "confirmAppointment"}
                    ]
                },
                who: {
                    id: "who",
                    initial: "prompt",
                    states: {
                        prompt: {
                            entry: {type: "spst.speak", params: {utterance: "Who would you like to book an appointment with?"}},
                            on: {SPEAK_COMPLETE: "processing"}
                        },
                        NoInput: {
                            entry: {type: "spst.speak", params: {utterance: "Sorry, who did you say you want to meet?"}},
                            on: {SPEAK_COMPLETE: "processing"}
                        },
                        processing: {
                            entry: {type: "spst.listen"},
                            on: {RECOGNISED: {
                                actions: ["extractEntities", assign({person: ({event}) => getPerson(event.nluValue)})]},
                                LISTEN_COMPLETE: { target: "#appointmentSystem.gatherInfo"},
                                ASR_NOINPUT: {target: "NoInput"},
                            },
                        },
                    },
                },
                day: {
                initial: "prompt",
                    states: {
                        prompt: {
                            entry: {type: "spst.speak", params: {utterance: "which day would you like the appointment to take place?"}},
                            on: {SPEAK_COMPLETE: "processing"}
                        },
                        NoInput: {
                            entry: {type: "spst.speak", params: {utterance: "Sorry, which day did you say you wanted the appointment?"}},
                            on: {SPEAK_COMPLETE: "processing"}
                        },
                        processing: {
                            entry: {type: "spst.listen"},
                            on: {RECOGNISED: {actions: ["extractEntities", assign({day: ({event}) => getDay(event.nluValue)})]},
                                LISTEN_COMPLETE: "#appointmentSystem.gatherInfo",
                                ASR_NOINPUT: {target: "NoInput"},
                            },
                        },
                    },
                },
                getTime: {
                    initial: "wholeDay",
                    states: {
                        wholeDay: {
                            initial: "prompt",
                            states: {
                                prompt: {
                                    entry: {type: "spst.speak", params: {utterance: "Will the meeting take the entire day?"}},
                                    on: {SPEAK_COMPLETE: "processing"}
                                },
                                NoInput: {
                                    entry: {type: "spst.speak", params: {utterance: "Sorry, I did not catch that."}},
                                    on: {SPEAK_COMPLETE: "prompt"}
                                },
                                processing: {
                                    entry: {type: "spst.listen"},
                                    on: {RECOGNISED: [{actions: ["extractEntities", assign({lastResult: ({event}) => event.value[0].utterance})]}],
                                        LISTEN_COMPLETE: [
                                            {guard: ({context}) => isAffirmative(context.lastResult.toLowerCase()),//affirmative, go to confirmAppointment
                                               actions: assign({isWholeDay: true}),
                                               target: "#confirmAppointment",
                                            },
                                            {guard: ({context}) => isNegative(context.lastResult.toLowerCase()),//negative, go to hour,
                                                target: "#hour",
                                            },
                                            {target: "NoInput"}
                                        ],
                                        ASR_NOINPUT: {target: "NoInput"},
                                    },
                                },
                            },
                        },
                        //there is a data issue which resuts in a need to repeat this until it is recognised, but there is nothing wrong with the code
                        hour: {
                            id: "hour",
                            initial: "prompt",
                            states: {
                                prompt: {
                                    entry: {type: "spst.speak", params: {utterance: "At what time do you want the appointment?"}},
                                    on: {SPEAK_COMPLETE: "processing"}
                                },
                                NoInput: {
                                    entry: {type: "spst.speak", params: {utterance: "Sorry, at what time did you say you wanted the appointment?"}},
                                    on: {SPEAK_COMPLETE: "processing"}
                                },
                                processing: {
                                    entry: {type: "spst.listen"},
                                    on: {RECOGNISED: [{actions: ["extractEntities", assign({time: ({event}) => getTime(event.nluValue)})]}],
                                        LISTEN_COMPLETE: "#appointmentSystem.gatherInfo",
                                        ASR_NOINPUT: {target: "NoInput"},
                                    },
                                },
                            },
                        },
                    },
                },
                confirmAppointment: {
                    id: "confirmAppointment",
                    initial: "prompt",
                    states: {
                        prompt: {
                            entry: {type: "spst.speak", 
                                    params: ({context}) => ({utterance: context.isWholeDay ? `Do you want to book a meeting with ${context.person} on ${context.day}?` : `Do you want to book a meeting with ${context.person} on ${context.day} at ${context.time}?`})
                            },
                            on: {SPEAK_COMPLETE: "processing"}
                        },
                        NoInput: {
                            entry: { 
                                type: "spst.speak", 
                                params: { utterance: "I didn't hear your response" } 
                            },
                            on: { SPEAK_COMPLETE: "processing" },
                        },
                        processing: {
                            entry: { type: "spst.listen" },
                            on: {
                                RECOGNISED: [{actions: ["extractEntities", assign({lastResult: ({event}) => event.value[0].utterance})]}],
                                LISTEN_COMPLETE: [
                                    {guard: ({context}) => isAffirmative(context.lastResult.toLowerCase()),//affirmative, go to confirmAppointment
                                        target: "#appointmentSystem.booked",
                                    },
                                    {guard: ({context}) => isNegative(context.lastResult.toLowerCase()),//negative, go to hour,
                                        target: "#who",
                                    },
                                    {target: "NoInput"}
                                ],
                                ASR_NOINPUT: { target: "NoInput" },
                            },
                            
                        },
                    },
                },
                booked: {
                    entry: {type: "spst.speak", params: {utterance: "Your appointment is booked"}},
                    on: {SPEAK_COMPLETE: "#Prepare"},
                },
            },
        },
        whoQueriesSystem: {
            id: "whoQueriesSystem",
            initial: "gatherInfo",
            states: {
                gatherInfo: {
                    always: [
                        {guard: ({context}) => !context.person,
                        target: "who"},
                        {guard: ({ context }) => !context.information,
                        target: "information"},
                    ] 
                },
                who:{ //for some reason it is better at identifying some of the names and not others -- Mickey and Elsa gets recognised the most
                    initial: "prompt",
                    states: {
                        prompt: {
                            entry: {type: "spst.speak", params: {utterance: "Who would you like to know more about?"}},
                            on: {SPEAK_COMPLETE: "processing"}
                        },
                        NoInput: {
                            entry: {type: "spst.speak", params: {utterance: "Sorry, who did you say you want to know more about?"}},
                            on: {SPEAK_COMPLETE: "processing"}
                        },
                        processing: {
                            entry: {type: "spst.listen"},
                            on: {RECOGNISED: {
                                actions: ["extractEntities", assign({person: ({event}) => getPerson(event.nluValue)})]
                                },
                                LISTEN_COMPLETE: [{
                                    target: "#whoQueriesSystem.gatherInfo", 
                                    },
                                ],
                                ASR_NOINPUT: {target: "NoInput"},
                            },
                        },
                    },
                },
                information: {
                    id: "information",
                    entry: {type: "spst.speak", params: ({context}) => ({utterance: `${getInformation(context.person)}`})},
                    on: {SPEAK_COMPLETE: "#Prepare"}
                },
            },
        },
    },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => {
    const meta: { view?: string } = Object.values(
      snapshot.context.spstRef.getSnapshot().getMeta(),
    )[0] || {
      view: undefined,
    };
    element.innerHTML = `${meta.view}`;
  });
}
