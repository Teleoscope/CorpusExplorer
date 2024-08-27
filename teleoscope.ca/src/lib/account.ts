import { client } from '@/lib/db';
import { ensure_db_collections_exist } from '@/lib/db';
import { get_stripe } from '@/lib/stripe';
import { Plans } from '@/lib/plans';
import { Users } from '@/types/users';
import { Teams } from '@/types/teams';
import { Workspaces } from '@/types/workspaces';
import { Workflows } from '@/types/workflows';
import { DEFAULT_SLATE, DEFAULT_TITLE_LENGTH } from './defaults';
import { MongoServerError } from 'mongodb';
import util from 'util';

export default async function initialize_user(
    userId: string,
    hashedPassword: string,
    email: FormDataEntryValue
) {
    const mongo_client = await client();
    const session = mongo_client.startSession();
    const db = mongo_client.db();
    const stripe = await get_stripe();

    // Ensure database collections exist in development environment
    if (process.env.NODE_ENV === 'development') {
        await ensure_db_collections_exist(db);
    }

    session.startTransaction();

    try {
        // Insert the user document
        const user: Users = {
            _id: userId,
            emails: [email.toString()],
            hashed_password: hashedPassword
        };
        const user_result = await db
            .collection<Users>('users')
            .insertOne(user, { session });

        // Find the default plan
        const default_plan = Plans.find((plan) => plan.name === 'Default');
        if (!default_plan) {
            throw new Error('No Default plan available.');
        }

        // Create an account document
        const account_doc = {
            users: {
                owner: userId
            },
            resources: {
                amount_teams_available: 1,
                amount_seats_available: 1,
                amount_storage_available: 100,
                amount_teams_used: 1,
                amount_seats_used: 1,
                amount_storage_used: 0
            },
            plan: {
                name: default_plan.name,
                plan_team_amount: default_plan.resources.teams,
                plan_collaborator_amount: default_plan.resources.seats,
                plan_storage_amount: default_plan.resources.storage,
                note: 'The default plan for every newly signed-up user.'
            }
        };

        const account_result = await db
            .collection('accounts')
            .insertOne(account_doc, { session });

        // Create a default team
        const team: Teams = {
            owner: user._id,
            label: 'Default team',
            account: account_result.insertedId,
            workspaces: [],
            users: []
        };
        const team_result = await db
            .collection('teams')
            .insertOne(team, { session });

        // Create a default workspace
        const workspace: Workspaces = {
            label: 'Default workspace',
            team: team_result.insertedId,
            workflows: [],
            settings: {
                document_height: 35,
                document_width: 100,
                expanded: false
            },
            storage: [],
            selected_workflow: null
        };
        const workspace_result = await db
            .collection<Workspaces>('workspaces')
            .insertOne(workspace, { session });

        // Update the team with the new workspace
        await db
            .collection<Teams>('teams')
            .updateOne(
                { _id: team_result.insertedId },
                { $push: { workspaces: workspace_result.insertedId } },
                { session }
            );

        // Create a default workflow
        const workflow: Workflows = {
            workspace: workspace_result.insertedId,
            label: 'Default workflow',
            nodes: [],
            edges: [],
            bookmarks: [],
            selection: {
                nodes: [],
                edges: []
            },
            settings: {
                color: DEFAULT_SLATE,
                title_length: DEFAULT_TITLE_LENGTH
            },
            last_update: new Date().toISOString(),
            logical_clock: 100
        };
        const workflow_result = await db
            .collection<Workflows>('workflows')
            .insertOne(workflow, { session });

        // Update the workspace with the new workflow
        await db.collection<Workspaces>('workspaces').updateOne(
            { _id: workspace_result.insertedId },
            {
                $push: { workflows: workflow_result.insertedId },
                $set: {
                    selected_workflow: workflow_result.insertedId
                }
            },
            { session }
        );

        // Check if the customer already exists in Stripe
        const customer = await stripe.customers.search({
            query: `metadata["userId"]:"${userId}"`
        });

        if (customer.data.length === 0) {
            // Create a new Stripe customer
            const new_customer = await stripe.customers.create({
                email: email.toString(),
                metadata: { userId }
            });

            // Search for the default subscription product in Stripe
            const default_subscriptions = await stripe.products.search({
                query: `name:\'Default\'`
            });

            if (default_subscriptions.data.length > 0) {
                const default_subscription = default_subscriptions.data[0];

                if (!default_subscription.default_price) {
                    throw new Error('Default subscription price not defined.');
                }

                // Create a new subscription for the customer
                const new_subscription = await stripe.subscriptions.create({
                    customer: new_customer.id,
                    items: [
                        {
                            price: default_subscription.default_price
                        }
                    ]
                });

                // Update the account with the Stripe customer ID
                await db
                    .collection('accounts')
                    .updateOne(
                        { _id: account_result.insertedId },
                        { $set: { stripe_id: new_customer.id } },
                        { session }
                    );

                await session.commitTransaction();
                console.log(
                    'Transaction committed. New user and customer created.'
                );
            } else {
                throw new Error(`Stripe default subscriptions error: 
                    ${util.inspect(default_subscriptions, {
                        showHidden: false,
                        depth: 3,
                        colors: true
                    })}
                `);
            }
        } else {
            throw new Error('Customer already exists in Stripe.');
        }
    } catch (error) {
        await session.abortTransaction();
        console.error('Transaction aborted due to an error:', error);
        if (error instanceof MongoServerError && error.code === 121) {
            console.error(
                'Document failed validation:',
                JSON.stringify(error, null, 2)
            );
        }
        throw error;
    } finally {
        await session.endSession();
    }
}
