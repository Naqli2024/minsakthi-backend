const mongoose = require("mongoose");
const dotenv = require("dotenv");
const ProcessTemplate = require("../models/processTemplateSchema");

dotenv.config();

const seedProcessTemplates = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected for seeding");

    // Define default Electrical & Maintenance SOP templates
    const templates = [
      {
        order: 1,
        processName: {
          en: "Technician Allocation",
          ta: "தொழில்நுட்ப நிபுணர் ஒதுக்கல்",
        },
        description: {
          en: "Assign a suitable technician for the job.",
          ta: "பணிக்கான பொருத்தமான தொழில்நுட்ப நிபுணரை ஒதுக்கவும்.",
        },
        defaultSubProcesses: [
          {
            name: {
              en: "Assign Technician",
              ta: "தொழில்நுட்ப நிபுணரை ஒதுக்குதல்",
            },
            description: {
              en: "Allocate a technician based on job type and availability.",
              ta: "பணியின் தன்மை மற்றும் கிடைக்கும் நிலை அடிப்படையில் தொழில்நுட்ப நிபுணரை ஒதுக்கவும்.",
            },
          },
        ],
      },
      {
        order: 2,
        processName: {
          en: "Site Visit",
          ta: "தளப் பார்வை",
        },
        description: {
          en: "Initial step where a technician visits the client site to inspect the issue or installation area.",
          ta: "தொழில்நுட்ப நிபுணர் வாடிக்கையாளர் தளத்தை சென்று பிரச்சினை அல்லது நிறுவல் பகுதியை ஆய்வு செய்வது முதல் நிலையாகும்.",
        },
        defaultSubProcesses: [
          {
            name: { en: "Schedule Visit", ta: "பார்வையை திட்டமிடுதல்" },
            description: {
              en: "Arrange a technician to visit the client site for initial inspection.",
              ta: "முதற்கட்ட ஆய்வுக்காக வாடிக்கையாளர் தளத்துக்கு தொழில்நுட்ப நிபுணரை ஏற்பாடு செய்யவும்.",
            },
          },
          {
            name: { en: "Arrival Confirmation", ta: "வருகை உறுதிப்படுத்தல்" },
            description: {
              en: "Confirm technician arrival via OTP or call.",
              ta: "OTP அல்லது தொலைபேசி அழைப்பின் மூலம் தொழில்நுட்ப நிபுணர் வருகையை உறுதிப்படுத்தவும்.",
            },
          },
          {
            name: { en: "Initial Observation", ta: "ஆரம்பக் கண்காணிப்பு" },
            description: {
              en: "Observe electrical system or maintenance area for visible issues.",
              ta: "மின்சார அமைப்பு அல்லது பராமரிப்பு பகுதியை கண்ணுக்குப் படும் பிரச்சினைகளுக்காக ஆய்வு செய்யவும்.",
            },
          },
        ],
      },
      {
        order: 3,
        processName: {
          en: "Issue or Installation Analysis",
          ta: "பிரச்சினை அல்லது நிறுவல் பகுப்பாய்வு",
        },
        description: {
          en: "Technician analyzes the site condition or identifies the main problem area before further action.",
          ta: "தொழில்நுட்ப நிபுணர் தளத்தின் நிலையை பகுப்பாய்வு செய்து முக்கிய பிரச்சினையை அடையாளம் காண்கிறார்.",
        },
        defaultSubProcesses: [
          {
            name: {
              en: "Problem Identification",
              ta: "பிரச்சினை அடையாளம் காணல்",
            },
            description: {
              en: "Technician identifies root cause or assesses installation location.",
              ta: "பிரச்சினையின் மூலக் காரணத்தையும் நிறுவல் இடத்தையும் தொழில்நுட்ப நிபுணர் மதிப்பீடு செய்கிறார்.",
            },
          },
          {
            name: { en: "Photo Documentation", ta: "புகைப்பட ஆவணப்படுத்தல்" },
            description: {
              en: "Capture images or videos for admin reference.",
              ta: "நிர்வாகி குறிப்பு நோக்கத்திற்காக புகைப்படங்கள் அல்லது வீடியோக்களை பதிவு செய்யவும்.",
            },
          },
          {
            name: { en: "Prepare Site Report", ta: "தள அறிக்கை தயாரித்தல்" },
            description: {
              en: "Generate a technical report describing problem details.",
              ta: "பிரச்சினை விவரங்களை விவரிக்கும் தொழில்நுட்ப அறிக்கையை உருவாக்கவும்.",
            },
          },
        ],
      },
      {
        order: 4,
        processName: {
          en: "Admin Review & BOM Calculation",
          ta: "நிர்வாகி மதிப்பாய்வு மற்றும் பொருள் பட்டியல் (BOM) கணக்கீடு",
        },
        description: {
          en: "Admin reviews technician findings and prepares the required Bill of Materials (BOM) for the job.",
          ta: "நிர்வாகி தொழில்நுட்ப நிபுணரின் அறிக்கையை மதிப்பாய்வு செய்து தேவையான பொருள் பட்டியலை (BOM) தயாரிக்கிறார்.",
        },
        defaultSubProcesses: [
          {
            name: {
              en: "Receive Technician Report",
              ta: "தொழில்நுட்ப நிபுணர் அறிக்கை பெறுதல்",
            },
            description: {
              en: "Admin reviews the technician’s field report.",
              ta: "நிர்வாகி தொழில்நுட்ப நிபுணரின் புல அறிக்கையை ஆய்வு செய்கிறார்.",
            },
          },
          {
            name: { en: "Material Estimation", ta: "பொருள் மதிப்பீடு" },
            description: {
              en: "Admin calculates materials and equipment required.",
              ta: "தேவையான பொருட்கள் மற்றும் உபகரணங்களை நிர்வாகி கணக்கிடுகிறார்.",
            },
          },
          {
            name: { en: "BOM Preparation", ta: "பொருள் பட்டியல் தயாரித்தல்" },
            description: {
              en: "Create a Bill of Materials with cost estimation.",
              ta: "செலவுக் கணக்குடன் பொருள் பட்டியலை (BOM) உருவாக்கவும்.",
            },
          },
        ],
      },
      {
        order: 5,
        processName: {
          en: "Quotation & Client Approval",
          ta: "மதிப்பீடு மற்றும் வாடிக்கையாளர் ஒப்புதல்",
        },
        description: {
          en: "Quotation is prepared and sent to the client for approval before proceeding with the job.",
          ta: "பணி தொடங்குவதற்கு முன் மதிப்பீடு தயார் செய்யப்பட்டு வாடிக்கையாளருக்கு அனுப்பப்படுகிறது.",
        },
        defaultSubProcesses: [
          {
            name: { en: "Quotation Generation", ta: "மதிப்பீடு தயாரித்தல்" },
            description: {
              en: "Prepare quotation based on BOM and service scope.",
              ta: "BOM மற்றும் சேவை வரம்பை அடிப்படையாகக் கொண்டு மதிப்பீட்டை உருவாக்கவும்.",
            },
          },
          {
            name: { en: "Client Communication", ta: "வாடிக்கையாளர் தொடர்பு" },
            description: {
              en: "Send quotation to the client for review.",
              ta: "மதிப்பீட்டை வாடிக்கையாளருக்கு மதிப்பாய்வுக்காக அனுப்பவும்.",
            },
          },
          {
            name: {
              en: "Approval Confirmation",
              ta: "ஒப்புதல் உறுதிப்படுத்தல்",
            },
            description: {
              en: "Client accepts the quotation and approves continuation.",
              ta: "வாடிக்கையாளர் மதிப்பீட்டை ஏற்று தொடர்வதை ஒப்புதல் அளிக்கிறார்.",
            },
          },
        ],
      },
      {
        order: 6,
        processName: {
          en: "Order Execution",
          ta: "ஆணை செயல்படுத்தல்",
        },
        description: {
          en: "Technician executes the order and completes fieldwork.",
          ta: "தொழில்நுட்ப நிபுணர் ஆணையை செயல்படுத்தி தளப்பணியை நிறைவேற்றுகிறார்.",
        },
        defaultSubProcesses: [
          {
            name: { en: "Material Procurement", ta: "பொருள் கொள்முதல்" },
            description: {
              en: "Collect or prepare required materials for the job.",
              ta: "பணிக்குத் தேவையான பொருட்களை சேகரிக்கவும் அல்லது தயாரிக்கவும்.",
            },
          },
          {
            name: { en: "Job Execution", ta: "பணி செயல்படுத்தல்" },
            description: {
              en: "Technician performs the service or installation.",
              ta: "தொழில்நுட்ப நிபுணர் சேவை அல்லது நிறுவலை மேற்கொள்கிறார்.",
            },
          },
          {
            name: { en: "Work Verification", ta: "பணி சரிபார்த்தல்" },
            description: {
              en: "Ensure work meets service quality standards.",
              ta: "பணி தரமான சேவை தரநிலைகளுக்கு ஏற்ப உள்ளது என்பதை உறுதிப்படுத்தவும்.",
            },
          },
        ],
      },
      {
        order: 7,
        processName: {
          en: "Completion & Review",
          ta: "முடிவு மற்றும் மதிப்பாய்வு",
        },
        description: {
          en: "Final stage of the service flow where completion is confirmed, feedback is taken, and the order is closed.",
          ta: "சேவை ஓட்டத்தின் இறுதி கட்டம் — முடிவு உறுதிப்படுத்தப்பட்டு, பின்னூட்டம் பெறப்பட்டு, ஆர்டர் மூடப்படுகிறது.",
        },
        defaultSubProcesses: [
          {
            name: { en: "Mark as Completed", ta: "முடிந்ததாக குறி" },
            description: {
              en: "Admin updates job status as completed.",
              ta: "நிர்வாகி பணியின் நிலையை முடிந்ததாகப் புதுப்பிக்கிறார்.",
            },
          },
          {
            name: { en: "Client Feedback", ta: "வாடிக்கையாளர் கருத்து" },
            description: {
              en: "Collect client review and rating for service quality.",
              ta: "சேவை தரம் குறித்து வாடிக்கையாளரின் மதிப்பீடு மற்றும் கருத்துக்களை பெறவும்.",
            },
          },
          {
            name: { en: "Close the Order", ta: "ஆர்டரை மூடுதல்" },
            description: {
              en: "Finalize and archive the completed service order.",
              ta: "முடிக்கப்பட்ட சேவை ஆர்டரை இறுதிப்படுத்தி, பதிவுசெய்யவும்.",
            },
          },
        ],
      },
    ];

    // Clear old templates before inserting new ones
    await ProcessTemplate.deleteMany({});
    console.log("Old process templates removed");

    // Insert default templates
    await ProcessTemplate.insertMany(templates);
    console.log(
      "Default Electrical & Maintenance SOP templates added successfully"
    );

    // Close DB connection
    await mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Error seeding process templates:", error.message);
    mongoose.connection.close();
  }
};

// Run seeder
seedProcessTemplates();
